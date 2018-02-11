declare var webkitURL: any;

/**
 * This class creates a web worker that runs in the background.
 * So the main browser thread can run without any interruption.
 * <p/>
 * A worker is an object created using a constructor (e.g. Worker()) that runs a named JavaScript file.
 * This file contains the code that will run in the worker thread; workers run in another global context that is
 * different from the current window. Thus, using the window shortcut to get the current global
 * scope (instead of self) within a Worker will return an error.
 * <p/>
 * Here we use {@code Blob} to run inline javascript code. We have to use pure javascript inside webworker.
 */
export class RecordWorker {

  static cmdInit = 'init';
  static cmdRecord = 'record';
  static cmdExportWav = 'exportWav';
  static cmdClear = 'clear';

  static getRecordingWorker(): RecordWorker {

    return new RecordWorker(function () {
      let recLength = 0,
        recBuffers = [],
        sampleRate,
        numChannels;

      // Interpret the relevant command and do action
      this.onmessage = function (event) {
        switch (event.data.command) {
          case 'init':
            init(event.data.config);
            break;
          case 'record':
            record(event.data.buffer);
            break;
          case 'exportWav':
            exportWav(event.data.type);
            break;
          case 'clear':
            clear();
            break;
        }
      };

      /**
       * Initializes recording buffer and config values
       */
      function init(config) {
        sampleRate = config.sampleRate;
        numChannels = config.numChannels;
      }

      /**
       * Method to save all the samples
       * @param inputBuffer the samples buffer
       */
      function record(inputBuffer) {
        recBuffers.push(inputBuffer);
        recLength += inputBuffer.length;
      }

      /**
       * Exports the binary to wav
       * @param type the mime type
       */
      function exportWav(type) {
        const dataView = encodeWav(recBuffers, recLength);
        const audioBlob = new Blob([dataView], { type: type });
        this.postMessage({ command: 'exportWav', data: audioBlob });
      }

      function clear() {
        recLength = 0;
        recBuffers = [];
      }

      function buffersTo16BitPCM(output, offset, input) {
        for (let i = 0; i < input.length; i++) {
          for (let j = 0; j < input[i].length; j++) {
            const sample = Math.max(-1, Math.min(1, input[i][j]));
            output.setInt16(offset, sample * 0x7FFF, true);
            offset += 2;
          }
        }
      }

      function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
          view.setUint8(offset + i, string.charCodeAt(i));
        }
      }

      /**
       * Encode the samples as wav.
       */
      // tslint:disable-next-line:no-shadowed-variable
      function encodeWav(recBuffers, recLength) {
        const buffer = new ArrayBuffer(44 + recLength * 2);
        const view = new DataView(buffer);

        /* RIFF identifier */
        writeString(view, 0, 'RIFF');
        /* RIFF chunk length */
        view.setUint32(4, 36 + recLength * 2, true);
        /* RIFF type */
        writeString(view, 8, 'WAVE');
        /* format chunk identifier */
        writeString(view, 12, 'fmt ');
        /* format chunk length */
        view.setUint32(16, 16, true);
        /* sample format (raw) */
        view.setUint16(20, 1, true);
        /* channel count */
        view.setUint16(22, numChannels, true);
        /* sample rate */
        view.setUint32(24, sampleRate, true);
        /* byte rate (sample rate * block align) */
        view.setUint32(28, sampleRate * 4, true);
        /* block align (channel count * bytes per sample) */
        view.setUint16(32, numChannels * 2, true);
        /* bits per sample */
        view.setUint16(34, 16, true);
        /* data chunk identifier */
        writeString(view, 36, 'data');
        /* data chunk length */
        view.setUint32(40, recLength * 2, true);

        buffersTo16BitPCM(view, 44, recBuffers);

        return view;
      }
    });

  }

  constructor(func) {
    let functionBody;
    // Gets the function body only
    functionBody = func.toString().trim().match(
      /^function\s*\w*\s*\([\w\s,]*\)\s*{([\w\W]*?)}$/
    )[1];

    URL = URL || webkitURL;
    return new Worker(URL.createObjectURL(
      new Blob([functionBody], { type: 'text/javascript' })
    ));
  }
}
