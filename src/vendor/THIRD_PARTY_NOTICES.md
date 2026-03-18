# Third-Party Notices

Last updated: March 17, 2026

## ONNX Runtime Web

- Package: `onnxruntime-web`
- Version: `1.23.2`
- Upstream repository: `https://github.com/microsoft/onnxruntime`
- License: `MIT`
- Vendored files:
  - `src/vendor/onnxruntime/ort.wasm.min.js`
  - `src/vendor/onnxruntime/ort-wasm-simd-threaded.wasm`
- Upstream metadata snapshot:
  - `src/vendor/onnxruntime/package.upstream.json`
  - `src/vendor/onnxruntime/README.upstream.md`

SHA-256:
- `ort.wasm.min.js`: `c6bc9f8e1d0ecc3983a57910e6a30b2230a512bcd2e0207cd64306459c3de7b4`
- `ort-wasm-simd-threaded.wasm`: `45eaee27761ad883742a8d4b8fce1538d60ce43b51adf1726fafccc59b8c1a15`

## MobileCLIP-S1 ONNX Vision Model

- Artifact lineage: `https://huggingface.co/Xenova/mobileclip_s1`
- Upstream project reference: `https://github.com/apple/ml-mobileclip`
- Local files:
  - `src/vendor/mobileclip-s1/vision_model_uint8.onnx`
  - `src/vendor/mobileclip-s1/preprocessor_config.json`
  - `src/vendor/mobileclip-s1/config.json`
- Upstream metadata snapshot:
  - `src/vendor/mobileclip-s1/README.upstream.md`
  - `src/vendor/mobileclip-s1/LICENSE.upstream`

License notes:
- The retained upstream model README declares `license: other`.
- The retained upstream license file is the Apple ML-MobileCLIP license text distributed with the model lineage used for this extension bundle.

SHA-256:
- `vision_model_uint8.onnx`: `6ec6b349e08a9258e41e45f1d143a9c3ffb6d6dcafa8249d88f3c618efda8b00`
- `preprocessor_config.json`: `b031f09fbd69e22a605b6cc7433993249ee893b7fc1b79321f669cd015493dd4`
- `config.json`: `9653c701b559b191c969929f640615ea386afb9d16deb08ba1520078bf4be23a`
