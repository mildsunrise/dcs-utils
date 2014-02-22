#!/usr/bin/env node

// By default, this reads Signed 16-bit PCM (little-endian) on STDIN
// and outputs the interleaved stream to the camera's speaker.

// Camera host and auth must be provided on the command line.

var util = require("util");
var stream = require("stream");
var http = require("http");


/**
 * The Transform class that does the interleaving.
 *
 * Pass in `options` to change the settings.
 * You're not advised to do it since you'd be
 * altering the default applet behaviour.
 **/

function DCSInterleaver(options) {
  if (!options) options = {};

  if (!options.chunkSize) options.chunkSize = 1024; 

  if (!options.audio) options.audio = {};
  if (!options.audio.bitRate) options.audio.bitRate = 16;
  if (!options.audio.sampleRate) options.audio.sampleRate = 8000;
  if (!options.audio.channels) options.audio.channels = 1;
  
  stream.Transform.call(this, options);
  this.options = options;
  this.chunk = Buffer(options.chunkSize);
  this.offset = 0;
}

util.inherits(DCSInterleaver, stream.Transform);

DCSInterleaver.prototype._transform = function (chunk, encoding, cb) {
  var offset = 0;
  while (offset < chunk.length) {
    var n = chunk.copy(this.chunk, this.offset, offset);
    offset += n; this.offset += n;
    if (this.offset == this.chunk.length) {
      var header = headerPacket(40, this.chunk.length, 1, 0, 0, 0, this.options.audio);
      this.push(header);
      this.push(this.chunk);
      this.offset = 0;
    }
  }
  cb();
};


/**
 * Logic which creates the header packet preceding chunks
 * in the interleaved stream.
 **/

function headerPacket(param1,
                      chunkSize,
                      param3,
                      param4,
                      param5,
                      param6,
                      audioInfo) {
  var header = Buffer(40);
  var i = 0;
  
  // hardcoded (???)
  header.writeInt32LE(-167706624, i); i+=4;

  header.writeInt32LE(param1, i); i+=4;
  header.writeInt32LE(chunkSize, i); i+=4;
  header.writeInt32LE(param3, i); i+=4;
  header.writeInt32LE(param4, i); i+=4;
  header.writeInt32LE(param5, i); i+=4;
  header.writeInt32LE(param6, i); i+=4;
  
  // hardcoded (sample rate?)
  header.writeInt16LE(16, i); i+=2;
  
  header.writeInt16LE(audioInfo.channels, i); i+=2;
  header.writeInt16LE(audioInfo.sampleRate, i); i+=2;
  header.writeInt16LE(audioInfo.bitRate, i); i+=2;
  
  // padding
  header.writeInt32LE(0, i); i+=4;
  
  return header;
}


/**
 * Logic to POST the interleaved stream to the DCS-2121's speaker.
 * Accept `options`, passed to `http.request`.
 * Expects at least `host` and `auth` to work.
 **/

function postSpeaker(options) {
  if (!options) options = {};
  if (!options.protocol) options.protocol = "http:";
  if (!options.agent) options.agent = false;
  
  if (!options.method) options.method = "POST";
  if (!options.path) options.path = "/dev/speaker.cgi";
  if (!options.headers) options.headers = {};
  if (!options.headers["Content-Type"])
    options.headers["Content-Type"] = "audio/ACAS";
  if (!options.headers["Content-Length"])
    options.headers["Content-Length"] = 4;
  
  var req = http.request(options);
  req.write("0000");
  
  return req;
}



if (module.parent) {
  // Export everything
  exports.DCSInterleaver = DCSInterleaver;
  exports.headerPacket = headerPacket;
  exports.postSpeaker = postSpeaker;
} else {
  // Read from STDIN, post to speaker
  if (process.argv.length < 4) {
    console.error("Not enough arguments.");
    process.exit(1);
  }
  
  var interleaver = new DCSInterleaver();
  var speakerStream = postSpeaker({
    host: process.argv[2],
    auth: process.argv[3]
  });
  
  process.stdin.pipe(interleaver);
  interleaver.pipe(speakerStream);
}
