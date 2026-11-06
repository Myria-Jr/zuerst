import type { LayersModel } from "@tensorflow/tfjs-layers";
import labels from "./imagenet-labels.json" with { type: "json" };
let model: Promise<LayersModel> | undefined;
export async function classifyFood(file: File): Promise<string[]> {
  if (!["image/jpeg","image/png","image/webp"].includes(file.type) || file.size > 20_000_000)
    throw new Error("Bitte ein Bild unter 20 MB auswählen.");
  const tf = await import("@tensorflow/tfjs-core");
  await import("@tensorflow/tfjs-backend-webgl");
  await import("@tensorflow/tfjs-backend-cpu");
  try {
    if(!await tf.setBackend("webgl")) await tf.setBackend("cpu");
  } catch {
    await tf.setBackend("cpu");
  }
  await tf.ready();
  model ??= import("@tensorflow/tfjs-layers")
    .then(({ loadLayersModel }) => loadLayersModel("/models/food/model.json"))
    .catch((error) => {
      model = undefined;
      throw error;
    });
  const loaded = await model;
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 224;
    canvas.height = 224;
    const context = canvas.getContext("2d");
    if (!context)
      throw new Error("Die Bildanalyse ist in diesem Browser nicht verfügbar.");
    const edge = Math.min(bitmap.width, bitmap.height);
    context.drawImage(
      bitmap,
      (bitmap.width - edge) / 2,
      (bitmap.height - edge) / 2,
      edge,
      edge,
      0,
      0,
      224,
      224,
    );
    const output = tf.tidy(() => {
      const input = tf.expandDims(
        tf.sub(
          tf.div(tf.cast(tf.browser.fromPixels(canvas), "float32"), 127.5),
          1,
        ),
        0,
      );
      const result = loaded.predict(input);
      if (Array.isArray(result)) throw new Error("Unerwartete Modellantwort.");
      return result;
    });
    try {
      const scores = Array.from(await output.data());
      return scores
        .map((score, index) => ({ score, index }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 8)
        .filter((x) => x.score >= 0.02)
        .map((x) => labels[String(x.index) as keyof typeof labels])
        .filter((x): x is string => typeof x === "string");
    } finally {
      output.dispose();
    }
  } finally {
    bitmap.close();
  }
}
