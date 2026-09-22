class AssemblyAiPcmProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const processorOptions = options.processorOptions || {};
    this.inputSampleRate = processorOptions.inputSampleRate || sampleRate;
    this.targetSampleRate = processorOptions.targetSampleRate || 24000;
    this.ratio = this.inputSampleRate / this.targetSampleRate;
  }

  process(inputs) {
    const input = inputs[0] && inputs[0][0];
    if (!input) return true;

    const outLength = Math.max(1, Math.floor(input.length / this.ratio));
    const pcm16 = new Int16Array(outLength);

    for (let index = 0; index < outLength; index += 1) {
      const sample = input[Math.min(input.length - 1, Math.floor(index * this.ratio))] || 0;
      pcm16[index] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    }

    this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    return true;
  }
}

registerProcessor("assemblyai-pcm-processor", AssemblyAiPcmProcessor);
