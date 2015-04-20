#!/usr/bin/env node
var logging = require("./logging");
var querystring = require("querystring");
var response = require("./response");
var config = require("./config");
var http = require("http");
var mime = require("mime");
var path = require("path");
var url = require("url");
var fs = require("fs");
var server = null;

var routes = {
  index: require("./routes/index"),
  avatars: require("./routes/avatars"),
  skins: require("./routes/skins"),
  renders: require("./routes/renders"),
  capes: require("./routes/capes")
};

function asset_request(req, res) {
  var filename = path.join(__dirname, "public", req.url.path_list.join("/"));
  fs.exists(filename, function(exists) {
    if (exists) {
      res.writeHead(200, {
        "Content-type": mime.lookup(filename),
        "Cache-Control": "max-age=7200, public", // cache for 2 hours
      });
      fs.createReadStream(filename).pipe(res);
    } else {
      res.writeHead(404, {
        "Content-type": "text/plain"
      });
      res.end("Not Found");
    }
  });
}

// generates a 12 character random string
function request_id() {
  return Math.random().toString(36).substring(2, 14);
}

// splits a URL path into an Array
// the path is resolved and decoded
function path_list(pathname) {
  // remove trailing and double slashes + other junk

  pathname = path.resolve(pathname);
  var list = pathname.split("/");
  list.shift();
  for (var i = 0; i < list.length; i++) {
    // URL decode
    list[i] = querystring.unescape(list[i]);
  }
  return list;
}

function requestHandler(req, res) {
  req.url = url.parse(req.url, true);
  req.url.query = req.url.query || {};
  req.url.path_list = path_list(req.url.pathname);

  req.id = request_id();
  req.start = Date.now();

  var local_path = req.url.path_list[0];
  logging.log(req.id, req.method, req.url.href);
  if (req.method === "GET" || req.method === "HEAD") {
    try {
      switch (local_path) {
        case "":
        routes.index(req, function(result) {
          response(req, res, result);
        });
        break;
        case "avatars":
        routes.avatars(req, function(result) {
          response(req, res, result);
        });
        break;
        case "skins":
        routes.skins(req, res);
        break;
        case "renders":
        routes.renders(req, res);
        break;
        case "capes":
        routes.capes(req, res);
        break;
        default:
        asset_request(req, res);
      }
    } catch(e) {
      var error = JSON.stringify(req.headers) + "\n" + e.stack;
      logging.error(req.id + "Error:", error);
      res.writeHead(500, {
        "Content-Type": "text/plain"
      });
      res.end(config.debug_enabled ? error : "Internal Server Error");
    }
  } else {
    res.writeHead(405, {
      "Content-Type": "text/plain"
    });
    res.end("Method Not Allowed");
  }
}

var exp = {};

exp.boot = function(callback) {
  var port = process.env.PORT || 3000;
  var bind_ip = process.env.BIND || "0.0.0.0";
  logging.log("Server running on http://" + bind_ip + ":" + port + "/");
  server = http.createServer(requestHandler).listen(port, bind_ip, function() {
    if (callback) {
      callback();
    }
  });
};

exp.close = function(callback) {
  server.close(function() {
    callback();
  });
};

module.exports = exp;

if (require.main === module) {
  logging.error("Please use 'npm start' or 'www.js'");
  process.exit(1);
}