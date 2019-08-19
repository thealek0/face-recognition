const express = require('express');

const router = express.Router();

const { FaceRecognitioService } = require('../../services/faceRecognition');

router.post('/recognizer', async (req, res) => {
  const image = req.files.image.data;
  const result = await FaceRecognitioService.recognize(image);

  res.json(result || {});
});

router.put('/recognizer', async (req, res) => {
  const image = req.files.image.data;
  const { label } = req.body;
  await FaceRecognitioService.addLabelToImage(image, label);

  res.json({ label });
});

module.exports = router;
