const cv = require('opencv4nodejs');

const tfjs = require('@tensorflow/tfjs-node');
const faceapi = require('face-api.js');

const modelsPath = `${__dirname}/../weights`;

const faceDetectionOptions = new faceapi.TinyFaceDetectorOptions({
  inputSize: 320,
  scoreThreshold: 0.5,
});
faceapi.nets.tinyFaceDetector.loadFromDisk(modelsPath);
faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);
faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);

class FaceMatcher extends faceapi.FaceMatcher {
  toJSON() {
    return JSON.stringify(this.labeledDescriptors);
  }

  static fromJSON(json, distance) {
    const data = JSON.parse(json);
    const labeledFaces = [];
    for (let i = 0; i < data.length; i += 1) {
      const element = data[i];
      const item = new faceapi.LabeledFaceDescriptors(
        element._label,
        element._descriptors.map(desc => new Float32Array(desc)),
      );
      labeledFaces.push(item);
    }
    return new this(labeledFaces, distance);
  }
}

const maxDescriptorDistance = 0.6;
let faceMatcher;

class FaceRecognitioService {
  static getTensor3dFromImage(image) {
    const imgMat = cv.imdecode(image);
    const array = new Uint8Array(imgMat.getData().buffer);
    return tfjs.tensor3d(array, [imgMat.rows, imgMat.cols, 3]);
  }

  static async detection(image) {
    const tensor3d = this.getTensor3dFromImage(image);
    return faceapi
      .detectSingleFace(tensor3d, faceDetectionOptions)
      .withFaceLandmarks()
      .withFaceDescriptor();
  }

  static async recognize(image) {
    try {
      const singleResult = await this.detection(image);

      if (singleResult) {
        const bestMatch = faceMatcher && faceMatcher.findBestMatch(singleResult.descriptor);
        console.dir(bestMatch, singleResult);
        return { detection: singleResult.detection, bestMatch: bestMatch || {} };
      }
      return { detection: {}, bestMatch: {} };
    } catch (error) {
      console.log(error);
      return { detection: {}, bestMatch: {} };
    }
  }

  static async addLabelToImage(image, label) {
    if (!image || !label) {
      console.warn('addLabel: required args');
      return;
    }

    const result = await this.detection(image);

    if (!result) {
      return;
    }

    const data = {
      label: label.toLowerCase(),
      descriptors: [result.descriptor],
    };

    const newLabel = new faceapi.LabeledFaceDescriptors(data.label, data.descriptors);

    if (!faceMatcher) {
      faceMatcher = new FaceMatcher([newLabel], maxDescriptorDistance);
      return;
    }
    faceMatcher.labeledDescriptors.push(newLabel);
  }
}

module.exports = {
  FaceRecognitioService,
};
