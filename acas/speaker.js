#!/usr/bin/env node

// Reads Signed 16-bit PCM (little-endian) on STDIN, encodes
// it and sends the ACAS stream to the camera's speaker,
// printing the response to STDOUT.

// Camera host and auth must be provided on the command line.

var http = require("http");

/**
 * Logic to POST the interleaved stream to the DCS-2121's speaker.
 *
 * Accepts `options`, passed to `http.request`.
 * Expects at least `host` and `auth` to work.
 **/

function sendSpeaker(options) {
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
  // Export sendSpeaker
  module.exports = sendSpeaker;
} else {
  // Read from STDIN, send to speaker
  var Encoder = require("./acas").ACASEncoder;
  
  if (process.argv.length < 4) {
    console.error("Not enough arguments.");
    process.exit(1);
  }
  
  var encoder = new Encoder();
  var speakerStream = sendSpeaker({
    host: process.argv[2],
    auth: process.argv[3]
  });
  // TODO: print response
  process.stdin.pipe(encoder).pipe(speakerStream);
}
