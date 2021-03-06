import List from './linked-list.js';
import DivIcon from './div-icon.js';

let Line = L.Polyline.extend({
  options: {
    color: '#4a4a4a',
    weight: 2,
    clickable: true
  }
});

let _cursorOffset, cursorOffset = 0.3; // смещение положения курсора относительно линии, при котором появляется метка маркера

export default L.Class.extend({
  initialize(map) {
    this._map = map;
    this.rulerOptions = this._map.__dr._options;

    if (this.rulerOptions._updateTooltipDistance) {
      this._updateTooltipDistance = this.rulerOptions._updateTooltipDistance;
    }

    if (this.rulerOptions._createTooltip) {
      this._createTooltip = this.rulerOptions._createTooltip;
    }

    cursorOffset = this.rulerOptions.cursorOffset || cursorOffset;

    _cursorOffset = this._recalcZoom();
  },
  _layerPaintPath: null,
  _layerPaintTemp: null,
  markers: [],
  _points: [],
  _tooltip: [],
  _hoverMarker: null,
  _distance: 0,

  isEmpty(value) {
    return (value === '') || (value === null) || (value === undefined) || (value.length === 0);
  },

  // interface

  createMarker(latlng) {
    let marker = L.marker(latlng, {
      icon: new DivIcon(this.rulerOptions.iconOptions),
      draggable: true,
      isDragging: false,
      riseOnHover: true
    }).addTo(this._layerPaint);

    marker.on('dragstart', this._onDragStartMarker.bind(this));
    marker.on('drag', this._onDragMarker.bind(this));
    marker.on('dragend', this._onDragEndMarker.bind(this));
    marker.on('click', this._onClickMarker.bind(this));

    return marker;
  },

  addMarker(latlng) {
    let marker = this.createMarker(latlng);

    marker.node = this.hash.add(marker);

    this.markers.push(marker);
    this._points.push(latlng);
    this.resetMarkersPositions();

    return marker;
  },

  removeMarker(marker) {
    let pos = marker.options.position;
    this._layerPaintPath.spliceLatLngs(pos, 1);

    this.hash.remove(pos);
    this.hash.resetPositions();
    this._layerPaint.removeLayer(marker);
    if (pos !== 0) {
      this._layerPaint.removeLayer(this._tooltip[pos - 1]);
      this._tooltip.splice(pos - 1, 1);
    }

    if (pos === 0 && this._tooltip.length) {
      this._layerPaint.removeLayer(this._tooltip[this._tooltip.length - 1]);
      this._tooltip.pop();
    }

    this.markers.splice(pos, 1);
    this._points.splice(pos, 1);

    this.resetMarkersPositions();
    this._resetTooltipPositions();

    if (this.markers.length === 1) {
      this._tooltip = [];
      this._distance = 0;
    }
  },

  resetMarkersPositions() {
    let pos = 0;
    this.markers.forEach((node) => {
      node.options.position = pos++;
    });
  },

  addHoverMarker(e, prevMarkerIndex) {
    e.target._map = e.target.__dr._map;
    this._hoverMarker = L.marker(e.latlng, {
      icon: new DivIcon(this.rulerOptions.iconOptions),
      draggable: true,
      position: this.hash._length
    }).addTo(this._layerPaint);

    this._hoverMarker.isDragging = false;
    this._hoverMarker.prevMarkerIndex = prevMarkerIndex;
    this._hoverMarker.on('dragstart', this._onDragStartHoverMarker.bind(this));
    this._hoverMarker.on('drag', this._onDragHoverMarker.bind(this));
    this._hoverMarker.on('dragend', this._onDragEndHoverMarker.bind(this));
    this._hoverMarker.node = this.hash.insertAfter(this._hoverMarker, prevMarkerIndex);
  },

  removeHoverMarker(e) {
    debugger;
    if (this._hoverMarker.prevMarkerIndex !== null) {
      this.hash.remove(this._hoverMarker.prevMarkerIndex + 1);
    }
    this._layerPaint.removeLayer(this._hoverMarker);
    this._hoverMarker = null;
  },

  redrawHoverMarker(e, prevMarkerIndex) {
    this._hoverMarker.setLatLng(e.latlng);
    if (prevMarkerIndex !== this._hoverMarker.prevMarkerIndex && !this._hoverMarker.isDragging) {
      this._hoverMarker.node = this.hash.insertAfter(this._hoverMarker, prevMarkerIndex);
      this._hoverMarker.prevMarkerIndex = prevMarkerIndex;
    }
  },

  insertAfter(pos, data) {
    let marker = this.createMarker(data._latlng);
    let tooltip = this._createTooltip(data._latlng);

    this._layerPaintPath.spliceLatLngs(pos, 0, data._latlng);
    tooltip.addTo(this._layerPaint);

    this.hash.insertAfter(marker, pos);
    marker.node = this.hash;

    this.markers.splice(pos, 0, marker);
    this._tooltip.splice(pos, 0, tooltip);
    this._points.splice(pos, 0, data._latlng);

    this.resetMarkersPositions();
  },

  get() {
  },
  getLast() {
  },
  getFirst() {
  },
  clear() {
  },

  _onDragStartMarker(e) {
    e.target.options.isDragging = true;
    this._points.splice(e.target.options.position, 1, e.target._latlng);
  },

  _onDragMarker(e) {
    this._layerPaintPath.spliceLatLngs(e.target.options.position, 1, e.target._latlng);
  },

  _onDragEndMarker(e) {
    e.target.options.isDragging = false;
    this._points.splice(e.target.options.position, 1, e.target._latlng);
    this._resetTooltipPositions();
  },

  _onDragStartHoverMarker(e) {
    this._hoverMarker.isDragging = true;
    if (!this._layerPaintTemp) {
      this._layerPaintTemp = L.polyline([this.markers[this._hoverMarker.prevMarkerIndex]._latlng, e.target._latlng, this.markers[this._hoverMarker.prevMarkerIndex + 1]._latlng], Object.assign({
        color: 'black',
        weight: 1.5,
        clickable: false,
        dashArray: '6,3'
      }, this.rulerOptions.paintLineOptions)).addTo(this._layerPaint);
    }
  },

  _onDragHoverMarker(e) {
    this._layerPaintTemp.spliceLatLngs(0, 2, this.markers[this._hoverMarker.prevMarkerIndex]._latlng, e.target._latlng, this.markers[this._hoverMarker.prevMarkerIndex + 1]._latlng);
  },

  _onDragEndHoverMarker(e) {
    debugger;
    this._hoverMarker.isDragging = false;
    this.insertAfter(this._hoverMarker.prevMarkerIndex + 1, e.target);
    this._map = this._map.removeLayer(this._hoverMarker);
    this._map.removeLayer(this._layerPaintTemp);
    this._layerPaintTemp = null;
    this._hoverMarker = null;

    this._resetTooltipPositions();
  },

  _onClickMarker(e) {
    let marker = e.target;
    marker._map.__dr.view.removeMarker(marker);
  },

  //inner functions (http://jtreml.github.com/leaflet.measure)
  __enabled: false,
  _toggleMeasure() {
    this.__enabled = !this.__enabled;

    if (this.__enabled) {
      this._startMeasuring();
    } else {
      this._stopMeasuring();
    }
  },

  _startMeasuring() {
    this._oldCursor = this._map._container.style.cursor;
    this._map._container.style.cursor = 'crosshair';

    this._doubleClickZoom = this._map.doubleClickZoom.enabled();
    this._map.doubleClickZoom.disable();

    L.DomEvent
      .on(this._map, 'zoomend', this._zoomChanged, this)
      .on(this._map, 'mousemove', this._mouseMove, this)
      .on(this._map, 'click', this._mouseClick, this)
      // .on(this._map, 'dblclick', this._dblClick, this)
      .on(document, 'keydown', this._onKeyDown, this);

    if (!this._layerPaint) {
      this._layerPaint = L.layerGroup().addTo(this._map);
    }

    if (!this._points) {
      this._points = [];
    }
  },

  _stopMeasuring() {
    this._map._container.style.cursor = this._oldCursor;

    L.DomEvent
      .off(document, 'keydown', this._onKeyDown, this)
      .off(this._map, 'mousemove', this._mouseMove, this)
      .off(this._map, 'click', this._mouseClick, this);
    // .off(this._map, 'dblclick', this._dblClick, this);

    if (this._doubleClickZoom) {
      this._map.doubleClickZoom.enable();
    }

    if (this._layerPaint) {
      this._layerPaint.clearLayers();
    }

    this._restartPath();
  },

  _mouseMove(e) {
    if (!e.latlng || !this._lastPoint) {
      return;
    }

    let new_latlng, prevMarkerIndex, markerUnderCursor;
    let distLine = _cursorOffset;
    let distMarker = _cursorOffset;
    this.markers.forEach((item, i) => {
      let distanceToCursor = L.point(e.latlng.lat, e.latlng.lng).distanceTo(L.point(this.markers[i]._latlng.lat, this.markers[i]._latlng.lng));
      if (distanceToCursor && distanceToCursor < distMarker) {
        markerUnderCursor = this.markers[i];
        distMarker = distanceToCursor;
      } else {
        if (i !== this.markers.length - 1) {
          distanceToCursor = this._calcHoverMarkerCoordinates(e.latlng, this.markers[i], this.markers[i + 1]);
          if (distanceToCursor && distanceToCursor.distance && distanceToCursor.distance < distLine) {
            new_latlng = distanceToCursor.latlng;
            distLine = distanceToCursor.distance;
            prevMarkerIndex = i;
          }
        }
      }
    });

    if (!this.isEmpty(new_latlng) && this.isEmpty(this.markers.find((marker) => {
        return marker.options.isDragging;
      }))) {
      let e_new = e;
      e_new.latlng = new_latlng;
      if (this.isEmpty(this._hoverMarker)) {
        this.addHoverMarker(e_new, prevMarkerIndex);
      } else {
        this.redrawHoverMarker(e_new, prevMarkerIndex);
      }
    } else {
      console.log('!this.isEmpty(this._hoverMarker)', this._hoverMarker && !this._hoverMarker.isDragging);
      if (this._hoverMarker && !this._hoverMarker.isDragging) {
        this.removeHoverMarker(e);
      }
    }

    if (!this.rulerOptions.paintLineOptions) {
      return;
    }

    if (!this._layerPaintPathTemp) {
      this._layerPaintPathTemp = L.polyline([this._lastPoint, e.latlng], Object.assign({
        color: 'black',
        weight: 1.5,
        clickable: false,
        dashArray: '6,3'
      }, this.rulerOptions.paintLineOptions)).addTo(this._layerPaint);
    } else {
      this._layerPaintPathTemp.spliceLatLngs(0, 2, this._lastPoint, e.latlng);
    }

    if (this._tooltip.length) {
      let tooltip_latlng = new_latlng ? L.latLng(new_latlng) : e.latlng;
      this._updateTooltipPosition(this._tooltip[this._tooltip.length - 1], tooltip_latlng);
      if (!this._lastPoint.equals(tooltip_latlng)) {
        var distance = tooltip_latlng.distanceTo(this._lastPoint);
        this._updateTooltipDistance(this._tooltip[this._tooltip.length - 1], this._distance + distance, distance);
      }
    }
  },

  _mouseClick(e) {
    // Skip if no coordinates
    if (!e.latlng) {
      return;
    }
    if (this.isEmpty(this._hoverMarker)) {
      this.addMarker(e.latlng);

      if (this.markers.length > 1) {
        this._addTooltip(e.latlng);
      }

      // If we have a tooltip, update the distance and create a new tooltip, leaving the old one exactly where it is (i.e. where the user has clicked)
      if (this._lastPoint && this._tooltip.length) {
        this._updateTooltipPosition(this._tooltip[this._tooltip.length - 1], e.latlng);

        var distance = e.latlng.distanceTo(this._lastPoint);
        this._updateTooltipDistance(this._tooltip[this._tooltip.length - 1], this._distance + distance, distance);

        this._distance += distance;
      }


      // If this is already the second click, add the location to the fix path (create one first if we don't have one)
      if (this._lastPoint && !this._layerPaintPath) {
        this._layerPaintPath = new Line([this._lastPoint], this.rulerOptions.lineOptions).addTo(this._layerPaint);
      }

      if (this._layerPaintPath) {
        this._layerPaintPath.addLatLng(e.latlng);
      }

      // Save current location as last location
      this._lastPoint = e.latlng;
    }
  },

  _recalcZoom: function (zoom = this._map.getZoom()) {
    return cursorOffset * Math.pow(2, 7 - zoom);
  },

  _zoomChanged() {
    let zoom = this._map.getZoom();

    _cursorOffset = this._recalcZoom(zoom);
  },

  _restartPath() {
    this._distance = 0;
    this._tooltip = [];
    this._lastCircle = undefined;
    this._lastPoint = undefined;
    this._layerPaintPath = undefined;
    this._layerPaintPathTemp = undefined;
    this.hash.clear();
    this.markers = [];
    this._points = [];
  },

  _createTooltip(position) {
    var tooltip, icon;

    icon = L.divIcon({
      className: 'ruler-tooltip',
      iconAnchor: [-5, -5]
    });

    tooltip = L.marker(position, {
      icon: icon,
      clickable: false
    });

    return tooltip;
  },

  _addTooltip(position) {
    var tooltip = this._createTooltip(position);

    this._tooltip.push(tooltip);

    tooltip.addTo(this._layerPaint);

    return tooltip;
  },

  _updateTooltipPosition(tooltip, latlng) {
    tooltip.setLatLng(latlng);
    tooltip.update();
  },

  _updateTooltipDistance(tooltip, total, difference) {
    var totalRound = total,
      differenceRound = difference;

    var text = '<div class="ruler-tooltip-total">' + totalRound + ' m</div>';
    if (differenceRound > 0 && totalRound != differenceRound) {
      text += '<div class="ruler-tooltip-difference">(+' + differenceRound + ' m)</div>';
    }

    tooltip._icon.innerHTML = text;
  },

  _resetTooltipPositions() {
    var total_distance = 0;
    if (this._points.length && this._tooltip.length) {
      for (var i = 0; i < this._points.length - 1; i++) {
        this._updateTooltipPosition(this._tooltip[i], this._points[i + 1]);
        var distance = this._points[i].distanceTo(this._points[i + 1]);
        this._updateTooltipDistance(this._tooltip[i], total_distance + distance, distance);
        total_distance += distance;
      }
    }
  },

  _onKeyDown(e) {
    if (e.keyCode == 27) {
      // If not in path exit measuring mode, else just finish path
      if (!this._lastPoint) {
        this._toggleMeasure();
      } else {
        this._finishPath();
      }
    }
  },

  hash: new List(),

  _calcHoverMarkerCoordinates(point, linePoint1, linePoint2) {
    let x0 = point.lat;
    let y0 = point.lng;
    let x1 = linePoint1._latlng.lat;
    let y1 = linePoint1._latlng.lng;
    let x2 = linePoint2._latlng.lat;
    let y2 = linePoint2._latlng.lng;
    let lineLength = L.point(x1, y1).distanceTo(L.point(x2, y2));
    let pointToLinePoint1 = L.point(x0, y0).distanceTo(L.point(x1, y1));
    let pointToLinePoint2 = L.point(x0, y0).distanceTo(L.point(x2, y2));

    let a = y2 - y1;
    let b = x1 - x2;
    let c = -x1 * y2 + x2 * y1;
    let t = L.point(a, b).distanceTo(L.point(0, 0));

    let distance = Math.abs((a * x0 + b * y0 + c) / t);

    if ((pointToLinePoint1 >= L.point(pointToLinePoint2, lineLength).distanceTo(L.point(0, 0))) ||
      (pointToLinePoint2 >= L.point(pointToLinePoint1, lineLength).distanceTo(L.point(0, 0)))) {
      return { latlng: null, distance };
    } else {
      if (distance < _cursorOffset) {
        let k = ((x0 - x1) * (x2 - x1) + (y0 - y1) * (y2 - y1)) / (Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
        let x3 = x1 - b * k;
        let y3 = y1 + a * k;

        return { latlng: { lat: x3, lng: y3 }, distance };
      }
    }
  }
});