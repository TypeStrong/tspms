//see https://github.com/bramstein/promis/
var internalId = 'Promise_internal' + (Math.random() * 1e9 >>> 0);
function setPromiseInternal(promise, internal) {
    Object.defineProperty(promise, internalId, {
        value: internal,
        writable: true
    });
}
function getPromiseInternal(promise) {
    return promise[internalId];
}
function resolve(promise, result) {
    var promiseInternal = getPromiseInternal(promise);
    if (promiseInternal.state === 0 /* PENDING */) {
        if (result === promise) {
            throw new TypeError('Promise resolved with itself.');
        }
        var called = false;
        try {
            var then = Object(result) === result && result.then;
            if (typeof then === 'function') {
                then.call(result, function (newResult) {
                    if (!called) {
                        resolve(promise, newResult);
                    }
                    called = true;
                }, function (error) {
                    if (!called) {
                        reject(promise, error);
                    }
                    called = true;
                });
                return;
            }
        }
        catch (e) {
            if (!called) {
                reject(promise, e);
            }
            return;
        }
        promiseInternal.state = 2 /* RESOLVED */;
        promiseInternal.value = result;
        notify(promise);
    }
}
;
function reject(promise, error) {
    var promiseInternal = getPromiseInternal(promise);
    if (promiseInternal.state === 0 /* PENDING */) {
        if (error === promise) {
            throw new TypeError('Promise rejected with itself.');
        }
        promiseInternal.state = 1 /* REJECTED */;
        promiseInternal.value = error;
        notify(promise);
    }
}
function notify(promise) {
    schedule(function () {
        var promiseInternal = getPromiseInternal(promise);
        if (promiseInternal.state !== 0 /* PENDING */) {
            while (promiseInternal.deferred.length) {
                var deferred = promiseInternal.deferred.shift(), onResolved = deferred[0], onRejected = deferred[1], resolve = deferred[2], reject = deferred[3];
                try {
                    if (promiseInternal.state === 2 /* RESOLVED */) {
                        if (typeof onResolved === 'function') {
                            resolve(onResolved.call(undefined, promiseInternal.value));
                        }
                        else {
                            resolve(promiseInternal.value);
                        }
                    }
                    else if (promiseInternal.state === 1 /* REJECTED */) {
                        if (typeof onRejected === 'function') {
                            resolve(onRejected.call(undefined, promiseInternal.value));
                        }
                        else {
                            reject(promiseInternal.value);
                        }
                    }
                }
                catch (e) {
                    reject(e);
                }
            }
        }
    });
}
var queue = [];
function drainQueue() {
    while (queue.length > 0) {
        var fn = queue.shift();
        fn();
    }
}
function schedule(callback) {
    queue.push(callback);
    setTimeout(drainQueue, 0);
}
var Promise = (function () {
    function Promise(callback) {
        var _this = this;
        setPromiseInternal(this, {
            value: undefined,
            state: 0 /* PENDING */,
            deferred: []
        });
        try {
            callback(function (r) { return resolve(_this, r); }, function (e) { return reject(_this, e); });
        }
        catch (e) {
            reject(this, e);
        }
    }
    Promise.prototype.then = function (onFulfill, onReject) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var promiseInternal = getPromiseInternal(_this);
            promiseInternal.deferred.push([onFulfill, onReject, resolve, reject]);
            notify(_this);
        });
    };
    Promise.prototype.catch = function (onReject) {
        return this.then(undefined, onReject);
    };
    Promise.resolve = function (object) {
        if (object instanceof Promise) {
            return object;
        }
        return new Promise(function (resolve, reject) {
            resolve(object);
        });
    };
    Promise.reject = function (error) {
        return new Promise(function (resolve, reject) {
            reject(error);
        });
    };
    Promise.all = function (promises) {
        return new Promise(function (resolve, reject) {
            var count = 0, result = [];
            if (promises.length === 0) {
                resolve(result);
            }
            for (var i = 0; i < promises.length; i += 1) {
                Promise.resolve(promises[i]).then(function (x) {
                    result[i] = x;
                    count += 1;
                    if (count === promises.length) {
                        resolve(result);
                    }
                }, reject);
            }
        });
    };
    Promise.race = function (promises) {
        return new Promise(function (resolve, reject) {
            for (var i = 0; i < promises.length; i += 1) {
                Promise.resolve(promises[i]).then(resolve, reject);
            }
        });
    };
    return Promise;
})();
exports.Promise = Promise;
function injectPromiseLibrary(promise) {
    exports.Promise = promise;
}
exports.injectPromiseLibrary = injectPromiseLibrary;
