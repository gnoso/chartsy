/*
 * chartsy.js
 * A graphing library for javascript; originally by Alan Johnson, Gnoso. Cleaned up and modified by Taylor Shuler.
 */
 
/*
 * Base class for graphs.
 */
var GraphBase = Class.create({
  /* 
   * Takes the element that should be used for the graph as an argument. 
   * Takes a set of options as the second parameter.
   *
   * Available Options:
   * TODO: Scaling
   * TODO: Image for points
   * TODO: Background image or canvas draw callback
   * 
   * Really Available Options:
   * connectPoints: whether to draw lines between points [boolean] 
   * pointImage: The image or function to use to draw a point [Image object or function]
   */
  initialize: function(element, options) {
    
    element = element;
    
    // figure out padding
    if (element.getStyle('padding-top')) {
      paddingTop = parseInt(element.getStyle('padding-top'));
    }
    else {
      paddingTop = 0;
    }
    if (element.getStyle('padding-bottom')) {
      paddingBottom = parseInt(element.getStyle('padding-bottom'));
    }
    else {
      paddingBottom = 0;
    }
    if (element.getStyle('padding-left')) {
      paddingLeft = parseInt(element.getStyle('padding-left'));
    }
    else {
      paddingLeft = 0;
    }
    if (element.getStyle('padding-right')) {
      paddingRight = parseInt(element.getStyle('padding-right'));
    }
    else {
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
    }
    else {
      // default options
      options = new Array();
    }
  
    /* if the user gave us a min and max x, use it, otherwise, just use the 
       height and width for the parameters */
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
  
    /* set up our scales */
    xScale = width / (options.maxX - options.minX);
    yScale = height / (options.maxY - options.minY);
  
    /* if there's no pointImage set up for the options, give it the default */
    if (!options.pointImage) {
      options.pointImage = function(x, y) {
        // just draw a circle on the canvas
        graphContext.beginPath();
        graphContext.fillStyle = "#000";
        graphContext.arc(x, y, 2, 0, Math.PI*2, true);
        graphContext.fill();
      };
    }
    
    /* if there's no connectPoints callback present, give it the default */
    if (!options.onConnectPoints) {
      options.onConnectPoints = function(x1, y1, x2, y2) {
        graphContext.beginPath();
        graphContext.strokeStyle = "#000";
        graphContext.moveTo(x1, y1);
        graphContext.lineTo(x2, y2);
        graphContext.stroke();
      };
    }
    
    if (!options.afterRedraw) {
      options.afterRedraw = Prototype.emptyFunction;
    }
    
    data = new Array();
    
    // put a placeholder div in
    var placeId = element.identify() + "_placeholder";
    element.insert("<div id=\"" + placeId + 
        "\" style=\"position: relative;height: " + backHeight + 
        "px;width: " + backWidth + "px; top: " + -paddingTop + "px;left: " +
        -paddingLeft + "px;\"></div");
    placeHolder = $(placeId);
    
    // put the background canvas in
    var backId = element.identify() + "_background"
    backCanvas = createCanvas(backId, backWidth, backHeight, 
      0, 0);
    backContext = backCanvas.getContext('2d');
    
    // put the overlay canvas in
    var overlayId = element.identify() + "_overlay"
    overlayCanvas = createCanvas(overlayId);
    overlayContext = overlayCanvas.getContext('2d');
    
    // put the graph canvas in
    var newId = element.identify() + "_canvas";
    graphCanvas = createCanvas(newId);
    graphContext = graphCanvas.getContext('2d');
    
    /* handle drawing the background */
    if (options.background) {
      if (Object.isFunction(options.background)) {
        var handler = options.background.bind(this);
        handler();
      }
      else {
        backContext.drawImage(options.background, 0, 0);
      }
    }
    
    /* add a mouseover event to the canvas --
       weird thing, we have to do it to the overlay */
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
      options.hoverThreshold = 5;
    }
    
  },
  
  /* Redraws the graph */
  redrawGraph: function() {
    clearPlotArea();
    sortData();
    
    for (var i = 0; i < data.length; i++) {
      x = data[i][0];
      y = data[i][1];
      
      // if there should be a line on the graph, add it
      // we want to skip the first point (it doesn't have anything to connect to)
      if (options.connectPoints && data.length > i + 1) {
        x2 = data[i + 1][0];
        y2 = data[i + 1][1];
        connectPoints(x, y, x2, y2);
      }
      
      // actually draw the point on the graph
      drawPoint(x, y);
    }
    
    // call the afterRedraw event
    var handler = options.afterRedraw.bind(this);
    handler();
  },
  
  addPoint: function(x, y, id) {
    // add new point to the data array
    data.push([x, y, id]);

    if (!redrawFrozen) {
      redrawGraph();
    }
  },
  
  /* points have to have an id to be removed */
  removePoint: function(id) {
    var match = null;
    for (var i = 0; i < data.length; i++) {
      if (data[i][2] == id) {
        match = i;
        break;
      }
    }
    
    if (match != null) {
      data.splice(match, 1);
    }
    
    if (!redrawFrozen) {
      redrawGraph();
    }
  },
  
  /* handles drawing a point on the canvas */
  drawPoint: function(x, y) {
    var pointImage = options.pointImage;
    if (Object.isFunction(pointImage)) {
      // handle custom functions
      var handler = pointImage.bind(this)
      handler(Math.round(scaleX(x)), Math.round(yToCanvas(scaleY(y))));
    }
    else {
      // treat it as an image
      width = pointImage.width;
      height = pointImage.height;
      x = Math.round(scaleX(x)) - (width / 2.0);
      y = Math.round(yToCanvas(scaleY(y))) - (height / 2.0);
      graphContext.drawImage(pointImage, x, y);
    }
  },
  
  /* handles connecting two points on the graph */
  connectPoints: function(x1, y1, x2, y2) {
    var handler = options.onConnectPoints.bind(this)
    handler(scaleX(x1), yToCanvas(scaleY(y1)), 
        scaleX(x2), yToCanvas(scaleY(y2)));
  },
  
  /* handles mouseovers */
  mouseMove: function(event) {
    // figure out where the x and y were in our canvas
    var offset = graphCanvas.cumulativeOffset();
    var eventX = Event.pointerX(event) - offset['left'];
    var eventY = yToCanvas(Event.pointerY(event) - offset['top']);
    
    // find a point that is a candidate for the hover
    var i = 0;
    var match = null;
    while (i < data.length) {
      point = data[i];
      xDiff = scaleX(point[0]) - eventX;
      if (xDiff <= options.hoverThreshold &&
          xDiff >= -options.hoverThreshold) {
        yDiff = scaleY(point[1]) - eventY;
        if (yDiff <= options.hoverThreshold &&
            yDiff >= -options.hoverThreshold) {
          match = i;
          break;
        }
      }
      i++;
    }
    
    // if we didn't get a match, do mouseOut or nothing
    if (match == null) {
      return unsetHovered();
    }
    
    // if we're already hovering on the item that we matched, do nothing
    if (match == hoveredItem) {
      return;
    }
    else {
      setHovered(match);
    }
  },
  
  // handles when the mouse leaves the canvas
  mouseOut: function(event) {
    unsetHovered();
  },
  
  // sets which item in the array is being hovered on, and calls the mouseOver
  // callback for it
  setHovered: function(id) {
    unsetHovered();
    
    hoveredItem = id;
    
    var handler = options.onMouseOver.bind(this);
    handler(data[hoveredItem][2], data[hoveredItem][0],
        data[hoveredItem][1], 
        Math.round(scaleX(data[hoveredItem][0])),
        Math.round(yToCanvas(scaleY(data[hoveredItem][1]))));
  },
  
  // unsets any previously set hovers, calling the mouseOut event if we have
  // a set hover
  unsetHovered: function() {
    if (hoveredItem != null) {
      var handler = options.onMouseOut.bind(this);
      handler(data[hoveredItem][2], data[hoveredItem][0],
          data[hoveredItem][1], scaleX(data[hoveredItem][0]),
          yToCanvas(scaleY(data[hoveredItem][1])));
    }
    
    hoveredItem = null;
  },
  
  /* sorts the array of data by the x-axis */
  sortData: function() {
    // unset the hovered item, since we go by array index right now
    unsetHovered();
    
    data.sort(function(a, b) { 
      return a[0] - b[0];
    });
  },
  
  /* converts y values to canvas coordinates */
  yToCanvas: function(y) {
    return height - y;
  },
  
  /* clears the graph area */
  clearPlotArea: function() {
   graphContext.clearRect(0, 0, width, height);
  },
  
  /* clears the overlay canvas */
  clearOverlay: function() {
    overlayContext.clearRect(0, 0, width, height);
  },
  
  /* freezes redrawing the graph */
  freezeRedraw: function() {
    redrawFrozen = true;
  },
  
  /* unfreezes redrawing
   * Optional parameter causes redraw to happen.
   */
  unfreezeRedraw: function(redrawNow) {
    
    redrawFrozen = false;
    
    if (redrawNow) {
      redrawGraph();
    }
  },
  
  /* scales an x value to the canvas */
  scaleX: function(x) {
    return (x - options.minX) * xScale;
  },
  
  /* scales a y value to the canvas */
  scaleY: function(y) {
    return (y - options.minY) * yScale;
  },
  
  /* method for creating a new canvas -- counts on excanvas for IE */
  createCanvas: function(id, width, height, left, top) {

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
        
    if (typeof G_vmlCanvasManager != "undefined") {
      // if we're using excanvas
      var canvas = document.createElement('canvas');
      placeHolder.insert(canvas);
      canvas.style.width = width;
      canvas.style.height = height;
      canvas.style.position = "absolute";
      canvas.style.top = top;
      canvas.style.left = left;
      canvas.style.cursor = "default";
      canvas.setAttribute('id', id);
      G_vmlCanvasManager.initElement(canvas);
    }
    else {
      // other browsers
      placeHolder.insert("<canvas id=\"" + id + "\" width=\"" + width + "\" " +
          "height=\"" + height + "\" style=\"position: absolute; top: " + top + 
          "px; left: " + left + "px;\" />");
    }
    
    return $(id);
  }
});