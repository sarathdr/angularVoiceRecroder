import {
  Component, Input, OnInit, ViewEncapsulation, Inject, NgZone
} from '@angular/core';

import { RecordService } from './record.service';

/** Hack for native webkitURL method */
declare var webkitURL: any;

/**
 * Component that handles sound recording and recording button animation.
 * @see <a hre="https://developer.mozilla.org/en/docs/Web/SVG/Tutorial/Paths">SVG</a>
 */
@Component({
  selector: 'app-recorder',
  templateUrl: './recorder.component.html',
  styleUrls: ['./recorder.component.css'],
  encapsulation: ViewEncapsulation.None
})
export class RecorderComponent implements OnInit {

  /** Factor to calculate the time interval for each frame */
  private readonly frameFactor = 500;

  /** Calculate the angle to sweep for each frame */
  private readonly angleToSweep = 360 / this.frameFactor;

  /** Maximum duration to record the voice  */
  private readonly recordDuration = 20000;

  /** Audio object to play the recorded voice */
  private audio: HTMLAudioElement = new Audio();

  /** Fill color for the record button */
  @Input() fillColor = '#ffffff';

  /** Stroke color for the record button */
  @Input() strokeColor = '#333333';

  /** Stroke  color of record button when recording is active */
  @Input() activeColor = '#E20074';

  /** Holds record icon path */
  @Input() iconInactive = 'assets/record.svg';

  /** Holds record icon path when recording is active */
  @Input() iconActive = 'assets/record-act.svg';

  /** Container box size */
  @Input() boxSize = 225;

  /** Circle radius */
  @Input() radius = 100;

  /** Circle border width */
  @Input() border = 8;

  /** Inner circle stroke width */
  @Input() strokeWidth = 3;

  /** SVG params */
  centerX: number;
  centerY: number;
  innerRadius: number;
  icon: string;
  audioFileUrl: string;

  arcSweep: string;
  circleM: string;
  circleL: string;
  circleA: string;
  circleEnd: string;

  isRecording = false;

  constructor(
    private recordService: RecordService,
    private zone: NgZone) { }

  ngOnInit() {
    this.setSvgInputs();
  }

  toggleRecording() {

    if (this.isRecording) {
      this.stopRecording();
    } else {
      try {
        this.recordService.startRecording(() => {

          this.isRecording = true;
          this.strokeColor = this.activeColor;
          this.icon = this.iconActive;

          // Start animation when we receive the call back that it started
          const timeInterval = this.recordDuration / this.frameFactor;
          this.zone.run(() => this.animationLoop(1, timeInterval));

        });

      } catch (error) {
        console.error(error);
        return;
      }
    }
  }

  private stopRecording() {
    this.isRecording = false;
    this.recordService.stopRecording().then(() => {
      /** Native URL object */
      URL = URL || webkitURL;
      this.audioFileUrl = URL.createObjectURL(this.recordService.getAudioBlob());
      console.log(this.audioFileUrl);
    });
  }

  play() {
    if (this.audioFileUrl != null) {
      this.audio.src = this.audioFileUrl;
      this.audio.load();
      this.audio.play();
      console.log('Playing');
    }
  }

  stop() {
    this.audio.pause();
  }

  /**
   * Presets all svg input values
   */
  private setSvgInputs() {
    this.centerX = this.boxSize / 2;
    this.centerY = this.boxSize / 2;
    this.icon = this.iconInactive;
    this.innerRadius = this.radius - this.border;
    this.inItSvg();
  }

  private inItSvg() {

    this.setAngleArcEnd(this.radius, 0);
    this.setArcSet(0);

    // Sets the staring point
    this.circleM = this.createArgument('M', this.centerX, this.centerY);

    // Set Lin To option here - The arc start point
    this.circleL = this.createArgument('L', this.centerX, (this.centerY - this.radius));

    // Set arc radius
    this.circleA = this.createArgument('A', this.radius, this.radius);
  }

  /**
   * Calculates the end position of the arc from the Line To point.
   *
   * @param radius the radius of the arc
   * @param radian the radian of the arc
   */
  private setAngleArcEnd(radius: number, radian: number) {
    const x = this.centerX + radius * Math.sin(radian);
    const y = this.centerY - radius * Math.cos(radian);
    this.circleEnd = this.createArgument(null, x, y);
  }

  /**
   * Rotate the arc direction based on the angle.
   * @param angle the angle
   */
  private setArcSet(angle) {
    if (Math.round(angle) <= 180) {
      this.arcSweep = this.createArgument(null, 0, 1);
    } else if (Math.round(angle) > 180) {
      this.arcSweep = this.createArgument(null, 1, 1);
    }
  }

  /**
   * Prepares SVG path dimensions based on the value supplied.
   * Eg: M0,100 , L 10,10 etc
   *
   * @param prefix the path option prefix (eg: M, L , A)
   * @param val1  the fist value to append
   * @param val2  the second value to append
   * @returns the prepared SVG dimensions
   */
  private createArgument(prefix: string, val1: number, val2: number) {
    if (prefix !== null) {
      return prefix + val1 + ',' + val2 + ' ';
    } else {
      return val1 + ',' + val2 + ' ';
    }
  }

  /**
   * Calculate the radian
   * 1 radian = PI/180
   */
  private angleToRad(angle) {
    return (angle * Math.PI) / 180;
  }

  /**
   * Handles animation
   * @param percent the percentage to sweep
   * @param timeInterval the time interval for each sweep
   */
  private animationLoop(percent: number, timeInterval: number) {

    setTimeout(() => {

      if (!this.isRecording) {
        return;
      }

      const angle = percent * this.angleToSweep;
      const radian = this.angleToRad(angle);
      this.setArcSet(angle);
      this.setAngleArcEnd(this.radius, radian);
      percent++;

      if (percent <= this.frameFactor) {
        this.animationLoop(percent, timeInterval);
      } else {
        this.stopRecording();
      }

    }, timeInterval);
  }

}
