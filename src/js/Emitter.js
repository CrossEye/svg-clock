var Emitter = (function() {
    var global = this;

    var sorter = function(first, second) {
        return second.priority - first.priority;
    };

    var each = function(fn, arr) {
        for (var i = 0, len = arr.length; i < len; i++) {fn(arr[i], i);}
    };

    var map = function(fn, list) {
        var idx = -1, len = list.length, result = new Array(len);
        while (++idx < len) {result[idx] = fn(list[idx]);}
        return result;
    };

    var reduce = function(fn, acc, list) {
        var idx = -1, len = list.length;
        while(++idx < len) {acc = fn(acc, list[idx]);}
        return acc;
    };

    var objKeys = Object.keys || function(obj) {
        var prop, ks = [];
        for (prop in obj) {if (obj.hasOwnProperty(prop)) {
            ks.push(prop);
        }}
        return ks;
    };

    var asyncSubCall = function(sub, delay, data, topic, onrData) {
        setTimeout(function() {
            sub.fn.call(sub.context, data, topic, onrData);
        }, delay);
    };

    var persistTopics = function(pubs, persist, data, onrData) {
        var config = {data: data, onrData: onrData};
        each(function(topic) {(pubs[topic] || (pubs[topic] = [])).push(config);}, persist);
    };

    var getTopics = (function() {
        var getBasics = function(count) {
            if (count === 1) {
                return ["0", "*", "**"];
            }
            return reduce (function(acc, base) {
                acc.push(base + "/" + (count - 1));
                acc.push(base + "/*");
                acc.push(base + "/**");
                return acc;
            }, [], getBasics(count - 1));
        };
        var addPartials = function(topic, obj) {
            var index = topic.indexOf("*/*"), newTopic;
            while (index > -1) {
                newTopic = (topic.substring(0, index) + "**" + topic.substring(index + 2)).replace(/\*\*+/g, "**");
                obj[newTopic] = 1;
                addPartials(newTopic, obj);
                index = topic.indexOf("/*", index + 1);
            }
        };
        var buildMatches = function(count)  {
            var keys = {}, results;
            each(function(topic) {
                keys[topic] = 1;
                addPartials(topic, keys);
            }, getBasics(count));
            results = objKeys(keys);
            return results;
        };
        var cache = {};
        var getTopicFunction = function(count) {
            return new Function("subtopics", "    return [\n        " + map(function(str) {
                return '"' + str.replace(/\d+/g, function(digits) {return '"' + ' + subtopics[' + digits + '] + "';}) + '"';
            }, buildMatches(count)).join(",\n        ") + "\n    ];");
        };
        return function(topic) {
            var subtopics = topic.split("/"), count = subtopics.length;
            return (cache[count] || (cache[count] = getTopicFunction(count)))(subtopics);
        };
    }());

    var createEmitter = function() {
        var allSubscriptions = [], topicSubscriptions = {}, persistedPublications = {};
        return {
            create: createEmitter,
            clear: function() {
                allSubscriptions = [];
                topicSubscriptions = {};
                onrsToAll = [];
            },
            on: function(topic, opts, fn) {
                if (!topic) {return;}
                if (!fn) {
                    fn = opts;
                    opts = null;
                }
                var id = allSubscriptions.length, subscription = {
                    fn: fn,
                    id: id,
                    status: "active",
                    async: (opts && opts.async) || false,
                    priority: (opts && opts.priority) || 0,
                    context: (opts && opts.context) || global
                };
                allSubscriptions.push(subscription);
                allSubscriptions.push(subscription);
                (topicSubscriptions[topic] || (topicSubscriptions[topic] = [])).push(subscription);
                if (!(opts && opts.persist === false) &&persistedPublications[topic]) {
                    for (var i = 0; i < persistedPublications[topic].length; i++) {
                        var config = persistedPublications[topic][i];
                        fn.call(subscription.context, config.data, topic, config.onrData);
                    }
                }
                return id;
            },
            emit: function(topic, data, opts) {
                var subscriptions, onrData = {}, response, allTopics = getTopics(topic),
                    persist = opts && opts.persist && allTopics;

                subscriptions = reduce(function(soFar, nextTopic) {
                    each(function(sub) {soFar.push(sub);}, topicSubscriptions[nextTopic] || []);
                    return soFar;
                }, [], getTopics(topic));
                subscriptions.sort(sorter);

                each(function(subscription, idx) {
                    if (subscription.status === "active" && (response !== false || (opts && opts.cancelable === false))) {
                        if ((opts && opts.async) || subscription.async) {
                            asyncSubCall(subscription, idx, data, topic, onrData);
                        } else {
                            response = subscription.fn.call(subscription.context, data, topic, onrData);
                        }
                    }
                }, subscriptions);
                if (persist) {
                    persistTopics(persistedPublications, persist, data, onrData);
                }
            },
            off: function(subId, permanent) {
                if (typeof subId === "number" && allSubscriptions[subId]) {
                    allSubscriptions[subId].status = permanent ? "removed" : "inactive";
                }
            },
            onAgain: function(subId) {
                if (typeof subId === "number" && allSubscriptions[subId] && allSubscriptions[subId].status !== "removed") {
                    allSubscriptions[subId].status = "active";
                }
            }
        };
    };
    return createEmitter();
}());