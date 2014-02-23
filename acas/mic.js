#!/usr/bin/env node

// Receives the ACAS stream from the camera's microphone,
// decodes it and outputs the audio stream to STDOUT,
// and header changes to STDERR.

// Camera host and auth must be provided on the command line.

var http = require("http");

/**
 * Logic to GET the interleaved stream of the DCS-2121's microphone.
 * The stream is presumably MU-LAW PCM.
 *
 * Accepts `options`, passed to `http.request`.
 * Expects at least `host` and `auth` to work.
 **/

function receiveMic(options, cb) {
  if (!options) options = {};
  if (!options.protocol) options.protocol = "http:";
  if (!options.agent) options.agent = false;
  if (!options.path) options.path = "/audio/ACAS-ULAW.cgi";
  
  return http.get(options, cb);
}


if (module.parent) {
  // Export receiveMic
  module.exports = receiveMic;
} else {
  // Receive from mic, write to STDOUT
  var Decoder = require("./acas").ACASDecoder;

  if (process.argv.length < 4) {
    console.error("Not enough arguments.");
    process.exit(1);
  }

  var micStreamReq = receiveMic({
    host: process.argv[2],
    auth: process.argv[3]
  }, function (micStream) {
    console.error("Connected, received %s.", micStream.statusCode);
    if (micStream.statusCode != 200) process.exit(1);
    
    var decoder = new Decoder();
    // TODO: header changes
    micStream.pipe(decoder).pipe(process.stdout);
  });
}
