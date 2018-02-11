import { Injectable } from '@angular/core';
import { RecordWorker } from './record-worker';

/** Hack to handle different browser native methods */
declare var webkitAudioContext: any;
declare var mozAudioContext: any;

/** Some native methods of AudioContext are missing in Typescript  */
interface AppAudioContext extends AudioContext {
  suspend: () => Promise<any>;
  resume: () => Promise<any>;
  close: () => Promise<any>;
  createJavaScriptNode: () => any;
}

/**
 * Service that handles recording from the audio resource.
 * It also runs a web worker that handle all recorded samples and process it.
 */
@Injectable()
export class RecordService {

  /**  Buffer length for the samples */
  private readonly bufferLen = 4096;

  /** Number of channels  */
  private readonly numChannels = 1;

  /** Recorded  file mime type */
  private readonly mimeType = 'audio/wav';

  private audioContext: AppAudioContext;
  private resourceNode: MediaStreamAudioSourceNode;
  private jsNode: ScriptProcessorNode;
  private sampleRate: number;
  private worker;

  /**
   * Holds the recorded binary.
   * Blob object represents a file-like object of immutable, raw data.
   */
  private audioBlob: Blob;

  /**
   * Array to store the callbacks, which will be triggered when a message
   * received from the worker.
   */
  private callbacks = {
    exportWav: []
  };

  constructor() {

    /** creates the web worker to handle audio process */
    this.worker = RecordWorker.getRecordingWorker();

    /** Sets handler to process the messaged received from web worker */
    this.worker.onmessage = (event) => {
      const callback = this.callbacks[event.data.command].pop();
      if (typeof callback === 'function') {
        callback(event.data.data);
      }
    };

    console.log('Record service created');
  }

  getAudioBlob(): Blob {
    return this.audioBlob;
  }

  /**
   * Reset the audio blob
   */
  clearAudioBlob() {
    this.audioBlob = null;
  }

  /**
   * Tries to initialize the audio context. Throws an error
   * if the browser does not support this feature.
   */
  private initAudioContext() {
    try {
      this.audioContext = new (AudioContext || webkitAudioContext || mozAudioContext)();
      this.sampleRate = this.audioContext.sampleRate;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Initializes the media stream and triggers the callback when recording starts.
   * @param callBackWhenStart method to call when the callback starts
   */
  private initMediaStream(callBackWhenStart: () => void) {

    const customNavigator = <any>navigator;

    /** Tries supported method to get user media object */
    navigator.getUserMedia =
      customNavigator.getUserMedia
      || customNavigator.webkitGetUserMedia
      || customNavigator.mozGetUserMedia
      || customNavigator.msGetUserMedia;

    navigator.getUserMedia({ audio: true }, (stream) => {
      this.resourceNode = this.audioContext.createMediaStreamSource(stream);
      /**
       * Creates script processor to process the media stream
       * The ScriptProcessorNode interface allows the generation, processing,
       * or analyzing of audio using JavaScript.
       */
      const scriptProcessor =
        this.audioContext.createScriptProcessor
        || this.audioContext.createJavaScriptNode;

      this.jsNode = scriptProcessor.call(
        this.audioContext,
        this.bufferLen,
        this.numChannels,
        this.numChannels
      );

      // Sets the handler for the media stream
      this.jsNode.onaudioprocess = (node) => {

        // Pass the buffer to the web worker to process it
        this.worker.postMessage({
          command: RecordWorker.cmdRecord,
          buffer: node.inputBuffer.getChannelData(0)
        });
      };

      // Initialize web worker to capture recording
      this.worker.postMessage({
        command: RecordWorker.cmdInit,
        config: {
          sampleRate: this.sampleRate,
          numChannels: this.numChannels
        }
      });

      this.resourceNode.connect(this.jsNode);
      this.jsNode.connect(this.audioContext.destination);

      callBackWhenStart();

    }, (error) => {
      throw error;
    });

  }

  /**
   * Starts recording, triggers the callback when recording starts.
   */
  startRecording(callBackWhenStart: () => void) {
    this.clearAudioBlob();
    this.initAudioContext();
    this.clearWorker();
    this.initMediaStream(callBackWhenStart);
  }

  /**
   * Returns a promise to stop the recording. It will
   * make sure that all the media resources are released after
   * the wav media file is exported.
   */
  stopRecording() {

    return new Promise((resolve) => {

      // Export content and save
      this.callbacks.exportWav.push((blob) => {

        // Persist the blob here.
        this.audioBlob = blob;

        // Release all media resources
        if (this.jsNode !== undefined) {
          this.jsNode.disconnect();
        }

        if (this.resourceNode !== undefined) {
          this.resourceNode.disconnect();
        }

        if (this.audioContext.state === 'running') {
          this.audioContext.close().then(() => {
            delete this.resourceNode;
            delete this.jsNode;
            resolve(true);
          });
        } else {
          resolve(true);
        }

      });

      // Post message to export wav file
      this.worker.postMessage({
        command: RecordWorker.cmdExportWav,
        type: this.mimeType
      });

    });

  }

  /**
   * Post message for the web worker to clear all buffers
   */
  private clearWorker() {
    this.worker.postMessage({
      command: RecordWorker.cmdClear
    });
  }

}
