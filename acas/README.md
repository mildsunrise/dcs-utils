# ACAS

The camera's web interface allows to talk through the speaker of the IP camera,
and to listen on the michrophone. Audio is transferred using a strange "ACAS" format.

I reverse-engineered the two applets that do the streaming and wrote this.  
It includes Node.JS modules to parse ACAS streams and command-line tools to
do the streaming (see the end).

This was tested with the 1.06 firmware on the DCS-2121.


## The ACAS format

Audio is sent in ACAS format, as MIME type `audio/ACAS`. The actual audio stream
is split in chunks, and each chunk is sent preceded by a header, which contains
info about, among other things, sample rate, bitrate, channels, chunk length and
header length (which is usually 40 bytes). See `formatHeader` and `parseHeader`.

ACAS encoding and decoding is implemented as `ACASEncoder` and `ACASDecoder`, which
are `Transform` classes that accept the audio stream and output ACAS, and viceversa.


## HTTP interaction

When interacting with the camera to receive or send ACAS streams, applets usually
send `User-Agent: IP Camera Viewer`, though that's not necessary at all.

**Important:** if the server promptly returns `500 Internal Error` while streaming,
you should reboot the camera and make sure you don't have the `Live Video` page
open while streaming.


## Talking through the speaker

The applet (`Speaker.jar`) streams linear PCM, signed, 16-bit little-endian,
with an 8000 Hz sample rate, in ACAS form.

It `POST`s the ACAS stream to `/dev/speaker.cgi`. `Content-Length` is set to `4` and
`0000` is written before actually writing the stream itself.

Each chunk is 1024 bytes long. `ACASEncoder` allows this to be changed, but it's not
recommended.

`sendSpeaker` implements sending of an ACAS stream to the speaker.


## Listening on the microphone

The applet (`Audio.jar`) can `GET` the audio stream from three sources, depending on the
required format: `/audio/ACAS-MSADPCM.cgi` (msadpcm???), `/audio/ACAS-ULAW.cgi` (MU-LAW),
and `/audio/ACAS.cgi` as the fallback for the other two.

`receiveMic` implements receiving of an ACAS stream in MU-LAW from the microphone.

TODO: sample rate, channels, bitrate, chunk & header size


## Usage

`acas.js` exports the encoder / decoder of ACAS streams, as explained above, as well as
`formatHeader` and `parseHeader`.

`speaker.js` and `mic.js` export `sendSpeaker` and `receiveMic`, respectively.

They can also work as command-line tools: `speaker.js` reads an appropiate audio
stream from STDIN and sends it as ACAS to the speaker. `mic.js` outputs the audio
stream from the microphone to STDOUT, and any changes in the header are output on
STDERR.

The syntax for both commands is:

``` bash
$ node speaker <camera hostname> <user:password>
$ node mic <camera hostname> <user:password>
```


## Streaming with FFMpeg

You can easily get an appropiate PCM stream for the speaker, as explained in
[Streaming](#streaming), by using `avconv` or `ffmpeg` (syntax is the same):

``` bash
$ avconv <input options> -f s16le -ac 1 -ar 8000 -
```

The above will output the stream to STDOUT, so you can pipe it to the `speaker.js`.

For example, to send audio from ALSA to the speaker:

``` bash
$ avconv -f alsa -i hw:0 -f s16le -ac 1 -ar 8000 - | node speaker 181.237.60.54 admin:superpassword
```
