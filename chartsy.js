/*
chartsy.js
A graphing library for HTML files written in JavaScript; originally by Alan Johnson, Gnoso. Cleaned up and modified by Taylor Shuler.
*/

var GraphBase;

// Base class for graphs
GraphBase = Class.create({
  initialize: function(element, options) {
    var backCanvas, backContext, backHeight, backId, backWidth, data, graphCanvas, graphContext, handler, height, hoveredItem, newId, overlayCanvas, overlayContext, overlayId, paddingBottom, paddingLeft, paddingRight, paddingTop, placeHolder, placeId, redrawFrozen, width, xScale, yScale;
    element = element;
    
    // figure out padding
    if (element.getStyle("padding-top")) {
      paddingTop = parseInt(element.getStyle("padding-top"));
    } else {
      paddingTop = 0;
    }
    if (element.getStyle("padding-bottom")) {
      paddingBottom = parseInt(element.getStyle("padding-bottom"));
    } else {
      paddingBottom = 0;
    }
    if (element.getStyle("padding-left")) {
      paddingLeft = parseInt(element.getStyle("padding-left"));
    } else {
      paddingLeft = 0;
    }
    if (element.getStyle("padding-right")) {
      paddingRight = parseInt(element.getStyle("padding-right"));
    } else {
      paddingRight = 0;
    }
    
    // figure out height and width
    width = parseInt(element.getWidth() - (paddingLeft + paddingRight));
    height = parseInt(element.getHeight() - (paddingTop + paddingBottom));
    backWidth = width + paddingLeft + paddingRight;
    backHeight = height + paddingTop + paddingBottom;
    redrawFrozen = false;
    if (options != null) {
      options = options;
    } else {
      options = new Array();
    }
    if (!options.minX) {
      options.minX = 0;
    }
    if (!options.minY) {
      options.minY = 0;
    }
    if (!options.maxX) {
      options.maxX = width;
    }
    if (!options.maxY) {
      options.maxY = height;
    }
    
    // set up our scales
    xScale = width / (options.maxX - options.minX);
    yScale = height / (options.maxY - options.minY);
    
    if (!options.pointImage) {
      options.pointImage = function(x, y) {
        graphContext.beginPath();
        graphContext.fillStyle = "#000";
        graphContext.arc(x, y, 2, 0, Math.PI * 2, true);
        return graphContext.fill();
      };
    }
    
    if (!options.onConnectPoints) {
      options.onConnectPoints = function(x1, y1, x2, y2) {
        graphContext.beginPath();
        graphContext.strokeStyle = "#000";
        graphContext.moveTo(x1, y1);
        graphContext.lineTo(x2, y2);
        return graphContext.stroke();
      };
    }
    
    if (!options.afterRedraw) {
      options.afterRedraw = Prototype.emptyFunction;
    }
    
    data = new Array();
    placeId = element.identify() + "_placeholder";
    element.insert("<div id=\"" + placeId + "\" style=\"position: relative;height: " + backHeight + "px;width: " + backWidth + "px; top: " + -paddingTop + "px;left: " + -paddingLeft + "px;\"></div");
    placeHolder = $(placeId);
    backId = element.identify() + "_background";
    backCanvas = createCanvas(backId, backWidth, backHeight, 0, 0);
    backContext = backCanvas.getContext("2d");
    overlayId = element.identify() + "_overlay";
    overlayCanvas = createCanvas(overlayId);
    overlayContext = overlayCanvas.getContext("2d");
    newId = element.identify() + "_canvas";
    graphCanvas = createCanvas(newId);
    graphContext = graphCanvas.getContext("2d");
    
    if (options.background) {
      if (Object.isFunction(options.background)) {
        handler = options.background.bind(this);
        handler();
      } else {
        backContext.drawImage(options.background, 0, 0);
      }
    }
    
    if (!options.onMouseOver) {
      options.onMouseOver = Prototype.emptyFunction;
    }
    
    if (!options.onMouseOut) {
      options.onMouseOut = Prototype.emptyFunction;
    }
    
    hoveredItem = null;
    Event.observe(graphCanvas, "mousemove", mouseMove.bindAsEventListener(this));
    Event.observe(graphCanvas, "mouseout", mouseOut.bindAsEventListener(this));
    
    if (!options.hoverThreshold) {
      return options.hoverThreshold = 5;
    }
  },
  redrawGraph: function() {
    var handler, i, x, x2, y, y2;
    clearPlotArea();
    sortData();
    i = 0;
    while (i < data.length) {
      x = data[i][0];
      y = data[i][1];
      if (options.connectPoints && data.length > i + 1) {
        x2 = data[i + 1][0];
        y2 = data[i + 1][1];
        connectPoints(x, y, x2, y2);
      }
      drawPoint(x, y);
      i++;
    }
    handler = options.afterRedraw.bind(this);
    return handler();
  },
  addPoint: function(x, y, id) {
    data.push([x, y, id]);
    if (!redrawFrozen) {
      return redrawGraph();
    }
  },
  removePoint: function(id) {
    var i, match;
    match = null;
    i = 0;
    while (i < data.length) {
      if (data[i][2] === id) {
        match = i;
        break;
      }
      i++;
    }
    
    if (match != null) {
      data.splice(match, 1);
    }
    
    if (!redrawFrozen) {
      return redrawGraph();
    }
  },
  drawPoint: function(x, y) {
    var handler, height, pointImage, width;
    pointImage = options.pointImage;
    if (Object.isFunction(pointImage)) {
      handler = pointImage.bind(this);
      return handler(Math.round(scaleX(x)), Math.round(yToCanvas(scaleY(y))));
    } else {
      width = pointImage.width;
      height = pointImage.height;
      x = Math.round(scaleX(x)) - (width / 2.0);
      y = Math.round(yToCanvas(scaleY(y))) - (height / 2.0);
      return graphContext.drawImage(pointImage, x, y);
    }
  },
  connectPoints: function(x1, y1, x2, y2) {
    var handler;
    handler = options.onConnectPoints.bind(this);
    return handler(scaleX(x1), yToCanvas(scaleY(y1)), scaleX(x2), yToCanvas(scaleY(y2)));
  },
  mouseMove: function(event) {
    var eventX, eventY, i, match, offset, point, xDiff, yDiff;
    offset = graphCanvas.cumulativeOffset();
    eventX = Event.pointerX(event) - offset["left"];
    eventY = yToCanvas(Event.pointerY(event) - offset["top"]);
    i = 0;
    match = null;
    while (i < data.length) {
      point = data[i];
      xDiff = scaleX(point[0]) - eventX;
      if (xDiff <= options.hoverThreshold && xDiff >= -options.hoverThreshold) {
        yDiff = scaleY(point[1]) - eventY;
        if (yDiff <= options.hoverThreshold && yDiff >= -options.hoverThreshold) {
          match = i;
          break;
        }
      }
      i++;
    }
    
    if (match == null) {
      return unsetHovered();
    }
    
    if (match === hoveredItem) {} else {
      return setHovered(match);
    }
  },
  mouseOut: function(event) {
    return unsetHovered();
  },
  setHovered: function(id) {
    var handler, hoveredItem;
    unsetHovered();
    hoveredItem = id;
    handler = options.onMouseOver.bind(this);
    return handler(data[hoveredItem][2], data[hoveredItem][0], data[hoveredItem][1], Math.round(scaleX(data[hoveredItem][0])), Math.round(yToCanvas(scaleY(data[hoveredItem][1]))));
  },
  unsetHovered: function() {
    var handler, hoveredItem;
    if (typeof hoveredItem !== "undefined" && hoveredItem !== null) {
      handler = options.onMouseOut.bind(this);
      handler(data[hoveredItem][2], data[hoveredItem][0], data[hoveredItem][1], scaleX(data[hoveredItem][0]), yToCanvas(scaleY(data[hoveredItem][1])));
    }
    return hoveredItem = null;
  },
  sortData: function() {
    unsetHovered();
    return data.sort(function(a, b) {
      return a[0] - b[0];
    });
  },
  yToCanvas: function(y) {
    return height - y;
  },
  clearPlotArea: function() {
    return graphContext.clearRect(0, 0, width, height);
  },
  clearOverlay: function() {
    return overlayContext.clearRect(0, 0, width, height);
  },
  freezeRedraw: function() {
    var redrawFrozen;
    return redrawFrozen = true;
  },
  unfreezeRedraw: function(redrawNow) {
    var redrawFrozen;
    redrawFrozen = false;
    if (redrawNow) {
      return redrawGraph();
    }
  },
  scaleX: function(x) {
    return (x - options.minX) * xScale;
  },
  scaleY: function(y) {
    return (y - options.minY) * yScale;
  },
  createCanvas: function(id, width, height, left, top) {
    var canvas;
    
    if (height == null) {
      height = height;
    }
    
    if (width == null) {
      width = width;
    }
    
    if (left == null) {
      left = paddingLeft;
    }
    
    if (top == null) {
      top = paddingTop;
    }
    
    if (typeof G_vmlCanvasManager !== "undefined") {
      canvas = document.createElement("canvas");
      placeHolder.insert(canvas);
      canvas.style.width = width;
      canvas.style.height = height;
      canvas.style.position = "absolute";
      canvas.style.top = top;
      canvas.style.left = left;
      canvas.style.cursor = "default";
      canvas.setAttribute("id", id);
      G_vmlCanvasManager.initElement(canvas);
    } else {
      placeHolder.insert("<canvas id=\"" + id + "\" width=\"" + width + "\" " + "height=\"" + height + "\" style=\"position: absolute; top: " + top + "px; left: " + left + "px;\" />");
    }
    return $(id);
  }
});