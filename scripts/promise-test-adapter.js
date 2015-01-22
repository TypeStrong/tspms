/*jshint node:true*/

var Promise = require('../built/promise').Promise;

var promisesAplusTests = require("promises-aplus-tests");

module.exports = {
    resolved: function(value) {
        return Promise.resolve(value);
    },
    rejected: function(reason) {
        return Promise.reject(reason);
    },
    deferred: function () {
        var resolve, reject, promise;
        promise = new Promise(function (res, rej) {
            resolve = res;
            reject = rej;
        });
        return {
            resolve: resolve,
            reject: reject,
            promise: promise
        };
    }
};
