var loopback = require('../loopback');
var juggler = require('loopback-datasource-juggler');
var remoting = require('strong-remoting');
var cls = require('continuation-local-storage');

module.exports = context;

var name = 'loopback';

function context(options) {
  options = options || {};
  var scope = options.name || name;
  var ns = cls.createNamespace(scope);

  // Make the namespace globally visible via the process.context property
  process.context = process.context || {};
  process.context[scope] = ns;

  // Set up loopback.getCurrentContext()
  loopback.getCurrentContext = function() {
    return ns;
  };

  if (typeof juggler.getCurrentContext === 'function') {
    var jugglerContext = new ChainedContext(juggler.getCurrentContext(), ns);
    juggler.getCurrentContext = function () {
      return jugglerContext;
    };
  } else {
    juggler.getCurrentContext = loopback.getCurrentContext;
  }

  if (typeof remoting.getCurrentContext === 'function') {
    var remotingContext = new ChainedContext(remoting.getCurrentContext(), ns);
    remoting.getCurrentContext = function () {
      return remotingContext;
    };
  } else {
    remoting.getCurrentContext = loopback.getCurrentContext;
  }

  // Return the middleware
  return function (req, res, next) {
    // Bind req/res event emitters to the given namespace
    ns.bindEmitter(req);
    ns.bindEmitter(res);
    // Create namespace for the request context
    ns.run(function (context) {
      // Run the code in the context of the namespace
      ns.set('req', req);
      ns.set('res', res);
      next();
    });
  };
}

/**
 * Create a chained context
 * @param {Object} child The child context
 * @param {Object} parent The parent context
 * @private
 * @constructor
 */
function ChainedContext(child, parent) {
  this.child = child;
  this.parent = parent;
}

/**
 * Get the value by name from the context. If it doesn't exist in the child
 * context, try the parent one
 * @param {String} name Name of the context property
 * @returns {*} Value of the context property
 */
ChainedContext.prototype.get = function (name) {
  var val = this.child && this.child.get(name);
  if (val === undefined) {
    return this.parent && this.parent.get(name);
  }
};

ChainedContext.prototype.set = function (name, val) {
  if (this.child) {
    return this.child.set(name, val);
  } else {
    return this.parent && this.parent.set(name, val);
  }
};

ChainedContext.prototype.reset = function (name, val) {
  if (this.child) {
    return this.child.reset(name, val);
  } else {
    return this.parent && this.parent.reset(name, val);
  }
};