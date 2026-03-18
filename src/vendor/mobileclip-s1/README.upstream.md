---
library_name: transformers.js
pipeline_tag: zero-shot-image-classification
license: other
tags:
- mobileclip
- image-feature-extraction
- feature-extraction
---

https://github.com/apple/ml-mobileclip with ONNX weights to be compatible with Transformers.js.

## Usage (Transformers.js)

If you haven't already, you can install the [Transformers.js](https://huggingface.co/docs/transformers.js) JavaScript library from [NPM](https://www.npmjs.com/package/@huggingface/transformers) using:
```bash
npm i @huggingface/transformers
```

**Example:** Perform zero-shot image classification.
```js
import {
  AutoTokenizer,
  CLIPTextModelWithProjection,
  AutoProcessor,
  CLIPVisionModelWithProjection,
  RawImage,
  dot,
  softmax,
} from '@huggingface/transformers';

const model_id = 'Xenova/mobileclip_s1';

// Load tokenizer and text model
const tokenizer = await AutoTokenizer.from_pretrained(model_id);
const text_model = await CLIPTextModelWithProjection.from_pretrained(model_id);

// Load processor and vision model
const processor = await AutoProcessor.from_pretrained(model_id);
const vision_model = await CLIPVisionModelWithProjection.from_pretrained(model_id);

// Run tokenization
const texts = ['cats', 'dogs', 'birds'];
const text_inputs = tokenizer(texts, { padding: 'max_length', truncation: true });

// Compute text embeddings
const { text_embeds } = await text_model(text_inputs);
const normalized_text_embeds = text_embeds.normalize().tolist();

// Read image and run processor
const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg';
const image = await RawImage.read(url);
const image_inputs = await processor(image);

// Compute vision embeddings
const { image_embeds } = await vision_model(image_inputs);
const normalized_image_embeds = image_embeds.normalize().tolist();

// Compute probabilities
const probabilities = normalized_image_embeds.map(
  x => softmax(normalized_text_embeds.map(y => 100 * dot(x, y)))
);
console.log(probabilities); // [[ 0.9999744722905349, 0.0000217474276948055, 0.00000378028177032859 ]]
```
