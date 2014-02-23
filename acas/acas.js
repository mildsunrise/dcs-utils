// Implements encoding / decoding of ACAS streams

var util = require("util");
var stream = require("stream");

/**
 * The Transform class that does the encoding of an ACAS stream.
 *
 * `options` allows you to customize what's send in the header.
 * It should match the audio stream that's being sent.
 *
 * Through `options.chunkLength` you can set the length of the chunks
 * (excluding header), which defaults to 1024. Set it to `-1` if you
 * want to send each chunk as soon as it arrives, without enforcing a
 * specific length.
 *
 * It's recommended that you keep the default options to preserve
 * the behaviour of the applet.
 **/

function ACASEncoder(options) {
  if (!options) options = {};

  if (!options.chunkLength) options.chunkLength = 1024; 

  if (!options.audio) options.audio = {};
  if (!options.audio.bitRate) options.audio.bitRate = 16;
  if (!options.audio.sampleRate) options.audio.sampleRate = 8000;
  if (!options.audio.channels) options.audio.channels = 1;
  
  stream.Transform.call(this, options);
  this.options = options;
  if (options.chunkLength != -1) {
    this.chunk = Buffer(options.chunkLength);
    this.offset = 0;
  }
}

util.inherits(ACASEncoder, stream.Transform);

ACASEncoder.prototype._processChunk = function (chunk) {
  var header = formatHeader(40, this.chunk.length, 1, 0, 0, 0, this.options.audio);
  this.push(header);
  this.push(this.chunk);
}

ACASEncoder.prototype._transform = function (chunk, encoding, cb) {
  if (this.options.chunkLength == -1) {
    this._processChunk(chunk);
  } else {
    var offset = 0;
    while (offset < chunk.length) {
      var n = chunk.copy(this.chunk, this.offset, offset);
      offset += n; this.offset += n;
      if (this.offset == this.chunk.length) {
        this._processChunk(this.chunk);
        this.offset = 0;
      }
    }
  }
  cb();
};


/**
 * The Transform class that does the decoding of an ACAS stream.
 * Header is parsed to the `header` property, you can read all
 * the parameters of the last header by accessing it.
 *
 * `options` allows you to customize how the stream's parsed.
 *
 * It's recommended that you keep the default options to preserve
 * the behaviour of the applet.
 *
 * Through `options.chunkLength` you can set the length of the chunks
 * (excluding header), that will be parsed. Setting it may possibly
 * produce completely erroneous results.
 * It defaults to `-1`, which will obey the header's info.
 **/

function ACASDecoder(options) {
  if (!options) options = {};

  if (!options.chunkLength) options.chunkLength = -1; 
  
  stream.Transform.call(this, options);
  this.options = options;
  this.header = {};
  this.headerData = Buffer(40);
  this.headerOffset = 0;
  this.chunkLength = options.chunkLength;
  this.chunkOffset = 0;
}

util.inherits(ACASDecoder, stream.Transform);

ACASDecoder.prototype._transform = function (chunk, encoding, cb) {
  var offset = 0;
  var n = 0;
  while (true) {
    if (offset >= chunk.length) break;
    /* Parse header */
    if (this.headerOffset < this.headerData.length) {
      n = chunk.copy(this.headerData, this.headerOffset, offset);
      offset += n; this.headerOffset += n;
      if (this.headerOffset == this.headerData.length) {
        parseHeader(this.headerData, this.header);
        if (this.options.chunkLength == -1)
          this.chunkLength = this.header.dataLength;
        this.chunkOffset = 0;
      }
    }
    
    if (offset >= chunk.length) break;
    /* Send chunk */
    if (this.chunkOffset < this.chunkLength) {
      n = chunk.slice(offset, offset + (this.chunkLength - this.chunkOffset));
      this.push(n);
      offset += n.length;
      this.chunkOffset += n.length;
      if (this.chunkOffset == this.chunkLength)
        this.headerOffset = 0;
    }
  }
  cb();
};


/**
 * Format a header.
 * (TODO: name / correct parameters)
 **/

function formatHeader(param1,
                      chunkLength,
                      param3,
                      param4,
                      param5,
                      param6,
                      audioInfo) {
  var buf = Buffer(40);
  var i = 0;
  
  // hardcoded (???)
  buf.writeInt32LE(-167706624, i); i+=4;

  buf.writeInt32LE(param1, i); i+=4;
  buf.writeInt32LE(chunkLength, i); i+=4;
  buf.writeInt32LE(param3, i); i+=4;
  buf.writeInt32LE(param4, i); i+=4;
  buf.writeInt32LE(param5, i); i+=4;
  buf.writeInt32LE(param6, i); i+=4;
  
  // hardcoded (sample rate?)
  buf.writeInt16LE(16, i); i+=2;
  
  buf.writeInt16LE(audioInfo.channels, i); i+=2;
  buf.writeInt16LE(audioInfo.sampleRate, i); i+=2;
  buf.writeInt16LE(audioInfo.bitRate, i); i+=2;
  
  // padding
  buf.writeInt32LE(0, i); i+=4;
  
  return header;
}


/**
 * Parse a header.
 **/

function parseHeader(buf, header) {
  var i = 0;
  
  header.headerId = buf.readInt32LE(i); i+=4;
  header.headerLength = buf.readInt32LE(i); i+=4;
  header.dataLength = buf.readInt32LE(i); i+=4;
  header.seqNumber = buf.readInt32LE(i); i+=4;
  
  // read as "longs" but they're actually ints
  header.timeSec = buf.readInt32LE(i); i+=4;
  header.timeUSec = buf.readInt32LE(i); i+=4;
  
  header.dataChecksum = buf.readInt32LE(i); i+=4;
  
  header.format = buf.readInt16LE(i); i+=2;
  header.channels = buf.readInt16LE(i); i+=2;
  header.sampleRate = buf.readInt16LE(i); i+=2;
  header.sampleBits = buf.readInt16LE(i); i+=2;
  
  header.reserved = buf.readInt32LE(i); i+=4;
  
  return header;
}


exports.ACASEncoder = ACASEncoder;
exports.ACASDecoder = ACASDecoder;
exports.formatHeader = formatHeader;
exports.parseHeader = parseHeader;