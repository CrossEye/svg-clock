var app = (function() {
    var app = (function () {
        var cache = {};

        var getTopic = function (topic) {
            return cache[topic] || (cache[topic] = []);
        };

        var emitData = function(data, callback) {
            callback.call(null, data);
            return data;
        };

        return {
            segments: ["seconds", "minutes", "hours"],
            on: function (topic, callback) {
                getTopic(topic).push(callback);
            },
            emit: function (topic, data) {
                getTopic(topic).reduce(emitData, data);
            }
        };
    }());

    app.on("start", function() {
        app.emit("init");
        app.emit("animate", true);
    });

    app.on("init", function() {
        [
            {type: "svg",       layer: 1,   class: "container", data: {
                version: "1.2", baseProfile: "tiny", viewBox: "0 0 200 200", "enable-background": "0 0 200 200"}},
            {type: "circle",    layer: 2,   class: "clock",     data: {
                cx: 100, cy: 100, r: 90}},
            {type: "text",      layer: 1,   class: "text",      textContent: "12",  data: {
                x: 92, y: 30}},
            {type: "text",      layer: 1,   class: "text",      textContent: "3",   data: {
                x: 175, y: 106}},
            {type: "text",      layer: 1,   class: "text",      textContent: "6",   data: {
                x: 96, y: 180}},
            {type: "text",      layer: 1,   class: "text",      textContent: "9",   data: {
                x: 18, y: 106}},
            {type: "line",      layer: 1,   class: "hours",     data: {
                x1: 100, y1: 45, x2: 100, y2: 100}},
            {type: "line",      layer: 1,   class: "minutes",   data: {
                x1: 100, y1: 25, x2: 100, y2: 100}},
            {type: "line",      layer: 1,   class: "seconds",   data: {
                x1: 100, y1: 15, x2: 100, y2: 100}},
            {type: "circle",    layer: 1,   class: "pin",     data: {
                cx: 100, cy: 100, r: 2}}
        ].forEach(function(element) {
            app.emit("create", element);
        });
    });

    app.on("create", (function() {
        return function(element) {
            SVG[element["class"]] = new SVG(element);  // TODO: Is the SVG constructor really the best object for a cache?
        };
    }()));

    var SVG = (function() {
        var SVG = function(config) {
            var prop;
            this.elm = document.createElementNS("http://www.w3.org/2000/svg", config.type);
            this.elm.setAttribute("class", config.class);
            if (config.textContent ) {
                this.elm.appendChild(document.createTextNode(config.textContent));
            }
            for (prop in (config.data || {})) {
                if (config.data.hasOwnProperty(prop) ) {
                    this.elm.setAttribute(prop, config.data[prop]);
                }
            }
            var layer = SVG.layers[config.layer];
            if (!layer) {
                SVG.layers[config.layer] = this.elm;
                layer = SVG.layers[config.layer - 1];
            }
            layer.appendChild(this.elm);
        };
        SVG.prototype.rotate = function (degrees, transition) {
            var origin = "transform-origin: 100 100;",
                transform = "transform:rotate(" + degrees + "deg);",
                style = origin  + transform +
                    "-ms-"      + origin    +
                    "-ms-"      + transform +
                    "-webkit-"  + origin    +
                    "-webkit-"  + transform;
            if (transition === false) {
                style += "transition: none;";
            }
            this.elm.setAttribute("style", style);
            return this;
        };
        SVG.layers = [document.getElementsByTagName("body")[0]];
        return SVG;
    }());

    (function () {
        var intervalData;

        app.on("animate", function (bool) {
            intervalData = bool ? setInterval( function() {
                app.emit( "createDate", new Date() );
            }, 1000) : clearInterval( intervalData );
        });
    }());

    app.on("createDate", function (date) {
        app.emit("split/seconds", date.getSeconds());
        app.emit("split/minutes", date.getMinutes());
        app.emit("split/hours", date.getHours());
    });

    (function() {
        var split = {}, timeComponent = {
            seconds: function (split) {return split.seconds * 6;},
            minutes: function (split) {return (split.minutes + (split.seconds / 60)) * 6;},
            hours: function (split) {return (split.hours % 12 * 30 ) + split.minutes / 2;}
        };
        app.segments.forEach(function(segment) {
            app.on("split/" + segment, function(segment) {
                return function(number) {
                    if (split[segment] !== number ) {
                        split[segment] = number;
                        app.emit( "draw/" + segment, timeComponent[segment](split));
                    }
                };
            }(segment));
        });
    }());

    app.segments.forEach(function(segment) {
        app.on("draw/" + segment, function (segment) {
            return function(degrees) {
                var hand = SVG[segment];
                if (degrees === 0 && hand.rotated) {
                    hand.rotate( 359.9 );
                    return setTimeout(function () {
                        hand.rotate(0, false);
                    }, 816);
                }
                if (!hand.rotated) {
                    hand.rotated = true;
                    return hand.rotate(degrees, false);
                }
                return hand.rotate(degrees);
            };
        }(segment));
    });

    return app;
}());

app.emit("start");
