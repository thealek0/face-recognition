if (!HTMLCanvasElement.prototype.toBlob) {
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    value: function (callback, type, quality) {
      var canvas = this;
      setTimeout(function() {
        var binStr = atob( canvas.toDataURL(type, quality).split(',')[1] ),
        len = binStr.length,
        arr = new Uint8Array(len);

        for (var i = 0; i < len; i++ ) {
           arr[i] = binStr.charCodeAt(i);
        }

        callback( new Blob( [arr], {type: type || 'image/png'} ) );
      });
    }
 });
}

if (!('createImageBitmap' in window)) {
  window.createImageBitmap = async function(blob) {
      return new Promise((resolve,reject) => {
          let img = document.createElement('img');
          img.addEventListener('load', function() {
              resolve(this);
          });
          img.src = URL.createObjectURL(blob);
      });
  }
}

const video = document.querySelector("#video");
// const outputCanvas = document.querySelector('#output');
const buttonStart = document.querySelector("#start");
const labelInput = document.querySelector("#label");
const labelResult = document.querySelector("#label-result");
const resultBlock = document.querySelector("#result");
const canvasOutput = document.querySelector("#image-result");
const canvasOutputContext = canvasOutput.getContext("2d");

const canvas = document.createElement("canvas");
const context = canvas.getContext("2d");
const apiEndpoint = "/api/recognizer";
const imageType = "image/png";

let lastTakenImage = null;
let fps = 1000 / 1;
let isStart = false;
let width = 720;
let height = 0;

if (navigator.mediaDevices.getUserMedia) {
  navigator.mediaDevices
    .getUserMedia({ video: { width: 720, height: 480 } })
    .then(stream => {
      video.srcObject = stream;
      video.play();
    })
    .catch(console.error);
}

video.addEventListener(
  "canplay",
  event => {
    height = video.height / (video.width / width);
    canvas.setAttribute("width", width);
    canvas.setAttribute("height", height);
    console.log(width, height);
  },
  false
);

function getImageFromWebcam(type, width, height) {
  context.drawImage(video, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(data => resolve(data), type);
  });
}

/**
 * Change stream fps
 * @param {int} value 
 */
function changeFps(value) {
  fps = 1000 / parseInt(value, 10);
  console.log(fps)
}

function send(url, method, data) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    for(key in data) {
      formData.append(key, data[key]);
    }
    // xhr.responseType = "json";
    xhr.open(method, url, true);
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = error => reject(error);
    xhr.send(formData);
  });
}

function setStreamUIState(state) {
  isStart = state;
  buttonStart.innerHTML = isStart ? "Stop stream" : "Start stream";
}

/**
 * Stream from webcam
 */
async function stream() {
  try {
    setStreamUIState(!isStart);

    while (isStart) {
      const data = await getImageFromWebcam(imageType, width, height);
      recognizer(data);
      await new Promise((resolve, reject) => setTimeout(() => resolve(), fps));
    }
  } catch (error) {
    setStreamUIState(false);
  }
}

/**
 * Once from webcam
 */
async function once() {
  setStreamUIState(false);
  const data = await getImageFromWebcam(imageType, width, height);
  recognizer(data);
}

/**
 * Upload image from disk.
 * @param {File} files - file to processing
 */
function upload(files) {
  if(!files.length) {
    return;
  }
  setStreamUIState(false);
  const file = files[0];
  recognizer(file);
}

async function recognizer(data) {
  if(!data) {
    return;
  }

  lastTakenImage = data;
  const blob = new Blob([data], { type: imageType });
  const response = await send(apiEndpoint, "POST", { "image": blob });
  const result = response && JSON.parse(response) || {};
  drawResult(result);
}

async function drawResult({ detection, bestMatch }) {
  const { _box: box = {}, _imageDims: image = {} } = detection;
  const { _label, _distance: distance } = bestMatch;
  let label = '';
  if(_label) {
    label = `${_label}: ${distance}`;
  }
  labelResult.innerHTML = label;
  const w = image._width || width;
  const h = image._height || height;
  const img = await createImageBitmap(lastTakenImage);
  canvasOutput.setAttribute("width", w);
  canvasOutput.setAttribute("height", h);
  canvasOutputContext.drawImage(img, 0, 0);
  if(box && image) {
    canvasOutputContext.strokeStyle = "red";
    canvasOutputContext.lineWidth = 3;
    canvasOutputContext.strokeRect(box._x, box._y, box._width, box._height)
  }
}

function addLabel() {
  const label = labelInput.value;
  if(!label) {
    alert('value required');
  }
  labelInput.value = '';
  const blob = new Blob([lastTakenImage], { type: imageType });
  send(apiEndpoint, "PUT", {  label, image: blob });
}
