'use strict';
var path = require('path');
var minimatch = require('minimatch');
var promise = require('./promise');
function createPromiseQueue() {
    var idHelper = 1;
    var items = [];
    var itemsMap = {};
    var itemsDeferred = {};
    var ready = true;
    var initialized = false;
    function drainQueue() {
        if (ready && initialized) {
            var id = items.shift();
            if (!id) {
                return;
            }
            ready = false;
            var item = itemsMap[id];
            var deferred = itemsDeferred[id];
            delete itemsMap[id];
            delete itemsDeferred[id];
            if (typeof item === 'function') {
                try {
                    item = item();
                }
                catch (e) {
                    deferred.reject(e);
                    ready = true;
                    drainQueue();
                }
            }
            promise.Promise.resolve(item).then(function (result) {
                deferred.resolve(result);
                ready = true;
                drainQueue();
            }, function (error) {
                deferred.reject(error);
                ready = true;
                drainQueue();
            });
        }
    }
    function reset(task) {
        var id = idHelper++;
        initialized = true;
        items.unshift(id);
        itemsMap[id] = task;
        var result = new promise.Promise(function (resolve, reject) {
            itemsDeferred[id] = { resolve: resolve, reject: reject };
        });
        drainQueue();
        return result;
    }
    function then(callback) {
        var id = idHelper++;
        items.push(id);
        itemsMap[id] = callback;
        var result = new promise.Promise(function (resolve, reject) {
            itemsDeferred[id] = { resolve: resolve, reject: reject };
        });
        drainQueue();
        return result;
    }
    return { then: then, reset: reset };
}
exports.createPromiseQueue = createPromiseQueue;
function mapValues(map) {
    return Object.keys(map).reduce(function (result, key) {
        result.push(map[key]);
        return result;
    }, []);
}
exports.mapValues = mapValues;
/**
 * assign all properties of a list of object to an object
 * @param target the object that will receive properties
 * @param items items which properties will be assigned to a target
 */
function assign(target) {
    var items = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        items[_i - 1] = arguments[_i];
    }
    return items.reduce(function (target, source) {
        return Object.keys(source).reduce(function (target, key) {
            target[key] = source[key];
            return target;
        }, target);
    }, target);
}
exports.assign = assign;
/**
 * clone an object (shallow)
 * @param target the object to clone
 */
function clone(target) {
    return assign(Array.isArray(target) ? [] : {}, target);
}
exports.clone = clone;
function createMap(arr) {
    return arr.reduce(function (result, key) {
        result[key] = true;
        return result;
    }, {});
}
exports.createMap = createMap;
/**
 * browserify path.resolve is buggy on windows
 * @param from an ABSOLUTE path
 * @param to an relative path
 */
function pathResolve(from, to) {
    var result = path.resolve(from, to);
    var index = result.indexOf(from[0]);
    return result.slice(index);
}
exports.pathResolve = pathResolve;
var Signal = (function () {
    function Signal() {
        /**
         * list of listeners that have been suscribed to this signal
         */
        this.listeners = [];
        /**
         * Priorities corresponding to the listeners
         */
        this.priorities = [];
    }
    /**
     * Subscribes a listener for the signal.
     *
     * @params listener the callback to call when events are dispatched
     * @params priority an optional priority for this signal
     */
    Signal.prototype.add = function (listener, priority) {
        if (priority === void 0) { priority = 0; }
        var index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.priorities[index] = priority;
            return;
        }
        for (var i = 0, l = this.priorities.length; i < l; i++) {
            if (this.priorities[i] < priority) {
                this.priorities.splice(i, 0, priority);
                this.listeners.splice(i, 0, listener);
                return;
            }
        }
        this.priorities.push(priority);
        this.listeners.push(listener);
    };
    /**
     * unsubscribe a listener for the signal
     *
     * @params listener the previously subscribed listener
     */
    Signal.prototype.remove = function (listener) {
        var index = this.listeners.indexOf(listener);
        if (index >= 0) {
            this.priorities.splice(index, 1);
            this.listeners.splice(index, 1);
        }
    };
    /**
     * dispatch an event
     *
     * @params parameter the parameter attached to the event dispatching
     */
    Signal.prototype.dispatch = function (parameter) {
        var hasBeenCanceled = this.listeners.every(function (listener) {
            var result = listener(parameter);
            return result !== false;
        });
        return hasBeenCanceled;
    };
    /**
     * Remove all listener from the signal
     */
    Signal.prototype.clear = function () {
        this.listeners = [];
        this.priorities = [];
    };
    /**
     * @return true if the listener has been subsribed to this signal
     */
    Signal.prototype.hasListeners = function () {
        return this.listeners.length > 0;
    };
    return Signal;
})();
exports.Signal = Signal;
function binarySearch(array, value) {
    var low = 0;
    var high = array.length - 1;
    while (low <= high) {
        var middle = low + ((high - low) >> 1);
        var midValue = array[middle];
        if (midValue === value) {
            return middle;
        }
        else if (midValue > value) {
            high = middle - 1;
        }
        else {
            low = middle + 1;
        }
    }
    return ~low;
}
exports.binarySearch = binarySearch;
function isAbsolute(fileName) {
    if (fileName.charAt(0) === "/" || fileName === "") {
        return true;
    }
    // pull off the device/UNC bit from a windows path.
    // from node's lib/path.js
    var splitDeviceRe = /^([a-zA-Z]:|[\\\/]{2}[^\\\/]+[\\\/]+[^\\\/]+)?([\\\/])?([\s\S]*?)$/;
    var result = splitDeviceRe.exec(fileName);
    var device = result[1] || '';
    var isUnc = device && device.charAt(1) !== ':';
    var isAbsolute = !!result[2] || isUnc; // UNC paths are always absolute
    return isAbsolute;
}
function match(baseDir, fileName, patterns, options) {
    var arrayPatterns = typeof patterns === 'string' ? [patterns] : patterns;
    fileName = path.resolve(baseDir, fileName);
    var result = false;
    for (var i = 0; i < arrayPatterns.length; i++) {
        var pattern = arrayPatterns[i];
        var exclusion = pattern.indexOf('!') === 0;
        if (exclusion) {
            pattern = pattern.slice(1);
        }
        if (!isAbsolute(pattern)) {
            pattern = path.resolve(baseDir, pattern);
        }
        if (minimatch(fileName, pattern, options)) {
            if (exclusion) {
                return false;
            }
            else {
                result = true;
            }
        }
    }
    return result;
}
exports.match = match;
