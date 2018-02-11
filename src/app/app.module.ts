import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';


import { AppComponent } from './app.component';
import { RecorderComponent } from './recorder/recorder.component';
import { RecordService } from './recorder/record.service';

@NgModule({
  declarations: [
    AppComponent,
    RecorderComponent
  ],
  imports: [
    BrowserModule
  ],
  providers: [
    RecordService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
