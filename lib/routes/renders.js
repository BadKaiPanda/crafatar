var logging = require("../logging");
var helpers = require("../helpers");
var renders = require("../renders");
var config = require("../config");
var cache = require("../cache");
var skins = require("../skins");
var path = require("path");
var fs = require("fs");

// valid types: head, body
// helmet is query param
// TODO: The Type logic should be two separate GET functions once response methods are extracted

// default alex/steve images can be rendered, but
// custom images will not be
function handle_default(rid, scale, helm, body, img_status, userId, size, def, err, callback) {
  if (def && def !== "steve" && def !== "alex") {
    callback({
      status: img_status,
      redirect: def,
      err: err
    });
  } else {
    def = def || skins.default_skin(userId);
    fs.readFile(path.join(__dirname, "..", "public", "images", def + "_skin.png"), function (fs_err, buf) {
      // we render the default skins, but not custom images
      renders.draw_model(rid, buf, scale, helm, body, function(render_err, def_img) {
        callback({
          status: img_status,
          body: def_img,
          type: "image/png",
          hash: def,
          err: render_err || fs_err || err
        });
      });
    });
  }
}

// GET render request
module.exports = function(req, callback) {
  var raw_type = (req.url.path_list[1] || "");
  var rid = req.id;
  var body = raw_type === "body";
  var userId = (req.url.path_list[2] || "").split(".")[0];
  var def = req.url.query.default;
  var scale = parseInt(req.url.query.scale) || config.default_scale;
  var helm = req.url.query.hasOwnProperty("helm");

  // validate type
  if (raw_type !== "body" && raw_type !== "head") {
    callback({
      status: -2,
      body: "Invalid Render Type"
    });
    return;
  }

  if (scale < config.min_scale || scale > config.max_scale) {
    callback({
      status: -2,
      body: "422 Invalid Scale"
    });
    return;
  } else if (!helpers.id_valid(userId)) {
    callback({
      status: -2,
      body: "422 Invalid ID"
    });
    return;
  }

  // strip dashes
  userId = userId.replace(/-/g, "");
  logging.debug(rid, "userId:", userId);

  try {
    helpers.get_render(rid, userId, scale, helm, body, function(err, status, hash, image) {
      if (err) {
        logging.error(rid, err);
        if (err.code === "ENOENT") {
          // no such file
          cache.remove_hash(rid, userId);
        }
      }
      if (image) {
        callback({
          status: status,
          body: image,
          type: "image/png",
          hash: hash,
          err: err
        });
      } else {
        logging.log(rid, "image not found, using default.");
        handle_default(rid, scale, helm, body, status, userId, scale, def, err, callback);
      }
    });
  } catch(e) {
    logging.error(rid, "error:", e.stack);
    handle_default(rid, scale, helm, body, -1, userId, scale, def, e, callback);
  }
};