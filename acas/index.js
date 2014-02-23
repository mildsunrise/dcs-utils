// Exports everything
var acas = require("./acas");

for (var name in acas)
  exports[name] = acas[name];

exports.sendSpeaker = require("./speaker");
exports.receiveMic = require("./mic");
