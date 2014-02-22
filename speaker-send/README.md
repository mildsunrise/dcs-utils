# speaker-send

The camera's web interface allows to talk through the speaker of the IP camera.  
I reverse-engineered the applet that does the streaming and wrote this.

This was tested with the 1.06 firmware.


## Streaming

The applet streams linear PCM, signed, 16-bit little-endian,
with an 8000 Hz sample rate.

It reads 1024-byte chunks of audio, composes a 40-byte header for each one, (see
`headerPacket`) and sends the header followed by the chunk (see `DCSInterleaver`).

This "interleaved" stream should be sent on an HTTP `POST` at `/dev/speaker.cgi`,
with `Content-Length: 4` and preceded by `0000`. (See `postSpeaker`)

**Important:** if the connection closes while streaming, make sure there's
no other process (like the browser) sending data. If the problem persists, reboot the
camera and try again.


## Usage

This is a simple Node.JS module containing a `Transform` class (`DCSTransform`) to do
the interleaving of the audio stream, and `postSpeaker` to send it.

It can also work as a command-line tool, reading the audio stream from STDIN
and posting it to the IP camera. The syntax is:

``` bash
$ node index <camera hostname> <user:password>
```


## Streaming with FFMpeg

You can easily get an appropiate PCM stream as explained in [Streaming](#streaming)
by using `avconv` or `ffmpeg` (syntax is the same):

``` bash
$ avconv <input options> -f s16le -ac 1 -ar 8000 -
```

The above will output the stream to STDOUT, so you can pipe it to the interleaver.

For example, to send audio from the microphone:

``` bash
$ avconv -f alsa -i hw:0 -f s16le -ac 1 -ar 8000 - | node index 181.237.60.54 admin:superpassword
```
