;
// 21.1 - Added koob axes
(function (name, definition) {
  var theModule = definition();

  if (typeof define === 'function' && define.amd) {                                                 // AMD
    define(theModule);
  } else if (typeof module !== 'undefined' && module.exports) {                                     // CommonJS
    module.exports = theModule
  } else if (typeof window !== 'undefined') {
    window[name] = theModule;
  }

})('bixel', function (undefined) {
  "use strict";

  var _msgCounter = 0;                                                                              // guid counter
  var _server = new Server();

  var Utils = {
    genUid: function () {
      return String(_msgCounter++);
    },
    isArray: function isArray(arg) {
      return Object.prototype.toString.call(arg) === '[object Array]';
    },
    formatNum: function formatNum(value, precision) {
      if (undefined === null || value === null || value === '' || !isFinite(value)) return '';
      if (precision === undefined) precision = 2;
      var separator = ' ';
      if (precision != -1) {
        value = value.toFixed(precision);
      }
      var a = ('' + value).split('.');
      a[0] = a[0]
          .split('').reverse().join('')
          .replace(/\d{3}(?=\d)/g, '$&' + separator)
          .split('').reverse().join('');
      if (a.length == 1) {
        return a[0];
      } else {
        return (0 == parseInt(a[1], 10) ? a[0] : a.join('.'));
      }
    }
  };


  /**
   * @constructor
   * @struct
   */
  function Server() {
    /**
     * Message listeners grouped by type
     * @type {{string, Function[]}}
     */
    var _listeners = {};

    /**
     * Listener to call when received ACK from server (fullfill and error)
     * grouped by message uid
     * @type {{string, [Function,Function}}
     */
    var _replyListeners = {};

    /**
     * Function that will be called after receiving a message of type
     * @type {Object.<string, Function>}
     * @private
     */
    var _messageInterceptors = {};

    if ((window !== undefined) && (window.parent !== window)) {
      if (window.addEventListener) {
        window.addEventListener('message', _onCrossFrameMessage);
      } else {
        window.attachEvent('onmessage', _onCrossFrameMessage);
      }
    }

    function _onCrossFrameMessage(event) {
      try {
        var srcWindow = event.source;
        if (srcWindow !== window.parent) {
          return;                                                                                   // accept only messages from parent window
        }
        _onMessage(event.data);

      } catch (err) {
        // ignore
      }
    }

    function _crossFrameSend(strMsg) {
      window.parent.postMessage(strMsg, '*');
    }

    function _send(msg) {
      var strMsg = JSON.stringify(msg);
      _crossFrameSend(strMsg);
    }

    /**
     * Parse message and run handlers
     * @param {string} msgStr JSON serialized message
     */
    function _onMessage(msgStr) {
      try {
        var msg = JSON.parse(msgStr);
        if (!('type' in msg)) {
          return;
        }
        var type = msg.type;
        var uid = msg.uid;
        var payload = msg.payload;

        var suffix = '';
        if (type.match(/^(.*?)(_OK|_FAILED)?$/)) {
          type = RegExp.$1;
          suffix = RegExp.$2;
        }

        var isResponseOk = suffix === '_OK';
        var isResponseFailed = suffix === '_FAILED';

        if (isResponseOk || isResponseFailed) {                                                     // got response
          if (uid in _replyListeners) {
            try {
              var listenersPair = _replyListeners[uid];
              var listener = (isResponseOk) ? listenersPair[0] : listenersPair[1];
              if (typeof listener === 'function') {
                var args = _messageInterceptors[type] ? _messageInterceptors[type](payload) : payload;
                listener(args);                                                                     // listener is Promise, we cannot pass many results, even if it is array
              }
            } catch (err) {
              console.log(err.stack);
            }
            delete _replyListeners[uid];
          }

        } else {                                                                                    // got command
          var succeeded = false;
          if (type in _listeners) {
            _listeners[type].forEach(function (listener) {                                          // notify all command listeners
              try {
                var args = _messageInterceptors[type] ? _messageInterceptors[type](payload) : payload;
                msg.payload = listener.apply(window, Utils.isArray(args) ? args : [args]);          // when payload is array, interpret it as array of arguments
                succeeded = true;                                                                   // if at least one handler is ok: send _OK
              } catch (err) {
                console.error(err);
                if (!succeeded) {
                  msg.payload = {
                    error: err.message
                  };
                }
              }
            });
          } else {
            msg.payload = {
              error: 'no handler'
            };
          }
          msg.type += succeeded ? '_OK' : '_FAILED';
          _send(msg);                                                                               // send response
        }

      } catch (err) {
        console.log(err.stack);
      }
    }

    /**
     * saves message listener
     * @param {string} type Message type on which subscribed to
     * @param {Function} listener A handler to call when message is received
     */
    this.addMessageListener = function (type, listener) {
      if (!_listeners.hasOwnProperty(type)) {
        _listeners[type] = [];
      }
      _listeners[type].push(listener);
    };

    this.removeMessageListener = function (type, listener) {
      if (!_listeners.hasOwnProperty(type)) {
        return false;
      }
      let idx = _listeners[type].indexOf(listener);
      if (idx === -1) {
        return false;
      }
      _listeners[type].splice(idx, 1);
      return true;
    };

    this.setInterceptor = function (type, fn) {
      _messageInterceptors[type] = fn;
    };

    /**
     * send message
     * @param {string} type Message type
     * @param {Object?} payload data to send
     */
    this.send = function (type, payload) {
      return new Promise(function (fulfill, reject) {
        var uid = Utils.genUid();
        var msg = {
          type: type,
          uid: uid,
          payload: payload
        };
        _replyListeners[uid] = [fulfill, reject];
        _send(msg);
      });
    }
  }


  function makeValue(v, unit, digits) {
    if (v == null) return '-';
    if (typeof v === 'string') return v;
    if (v instanceof String) return v.valueOf();
    if (v instanceof Number) v = v.valueOf();
    if (isNaN(v)) return '-';
    if (digits == null) digits = 2;
    var strValue = (unit && unit.config && unit.config.valueMap && (v in unit.config.valueMap))
        ? unit.config.valueMap[v]
        : Utils.formatNum(v, digits);
    if (unit) {
      if (unit.value_prefix) strValue = unit.value_prefix + ' ' + strValue;
      if (unit.value_suffix) strValue = strValue + ' ' + unit.value_suffix;
    }
    return strValue;
  }


  function _createKoobAxes(subspace, data) {
    var result = {};
    if (!data) {                                                                                    // TODO: return miningfull functions getXs(), getYs()
      return result;
    }

    var xAxis = subspace.xs || [];
    var yAxis = subspace.ys || [];
    var zAxis = subspace.zs || [];

    result.getXs = function () {
      return xAxis;
    };

    result.getYs = function () {
      return yAxis;
    };

    result.getZs = function () {
      return zAxis;
    }
    result.data = {};

    result.data.getValue = function (x, y, z) {
      var xi = xAxis.indexOf(x); if (xi === -1) xi = xAxis.indexOf(y);
      var yi = yAxis.indexOf(y); if (yi === -1) yi = yAxis.indexOf(x);
      if (xi === -1 || yi === -1) {
        return NaN;
      }
      var value = data[yi][xi];
      return new Number(value);
    }


    // // make measures an axis
    // var shallowClone = function(o) { var result = {}; for (var key in o) result[key] = o[key]; return result };
    // if (subspace.measures && subspace.measures.length) {
    //   var dataWithMeasuresAsDimensions = [];                                                        // each entry will be splitted to several entries each with one measure
    //   data.forEach(function (dataEntry) {
    //     var measuresPart = {};
    //     (subspace.measures || []).forEach(function (measure) {
    //       measuresPart[measure.id] = dataEntry[measure.id];
    //       delete dataEntry[measure.id];
    //     });
    //     (subspace.measures || []).forEach(function (measure) {
    //       var dataEntryClone = shallowClone(dataEntry);
    //       dataEntryClone.measures = measure.id;
    //       dataEntryClone.val = measuresPart[measure.id];
    //       dataWithMeasuresAsDimensions.push(dataEntryClone);
    //     });
    //   });
    //   data = dataWithMeasuresAsDimensions;
    // }

    // var uniqueMembersByAxisId = {};
    // data.forEach(function (dataEntry) {
    //   Object.keys(dataEntry).forEach(function (key) {
    //     if (!(key in uniqueMembersByAxisId)) uniqueMembersByAxisId[key] = {};
    //     uniqueMembersByAxisId[key][dataEntry[key]] = true;
    //   })
    // });
    // for (var key in uniqueMembersByAxisId) uniqueMembersByAxisId[key] = Object.keys(uniqueMembersByAxisId[key]);

    // // var axes = Object.keys(uniqueMembersByAxisId).map(function(key) {
    // //   return {
    // //     title: key,
    // //     id: key,
    // //     members: uniqueMembersByAxisId[key]
    // //   };
    // // });

    // function makeOneLevelAxis(xyzId, cfg, data) {
    //   var axisId = cfg;
    //   var result = [];
    //   var visited = {};
    //   data.forEach(function (dataEntry) {
    //     var entryId = dataEntry[axisId];
    //     if (visited[entryId]) return;
    //     visited[entryId] = true;
    //     var search = {};
    //     search[axisId] = dataEntry[axisId];
    //     var title = dataEntry[axisId];
    //     result.push({
    //       id: entryId,
    //       groupAxisId: xyzId,
    //       axisId: axisId,
    //       title: title,
    //       search: search,
    //     });
    //   });
    //
    //   result.id = xyzId;
    //   result.axisId = axisId;
    //   result.depth = 1;
    //
    //   return result;
    // }

    // function makeGroupAxis(xyzId, cfg, data) {
    //   var axisIds = cfg.split(',');
    //   var result = [];
    //   var visited = {};
    //   data.forEach(function (dataEntry) {
    //     var entryId = axisIds.map(key => dataEntry[key]).join(',');
    //     if (visited[entryId]) return;
    //     visited[entryId] = true;
    //     var search = {};
    //     axisIds.forEach(key => search[key] = dataEntry[key]);
    //     var titles = axisIds.map(key => dataEntry[key]);
    //     result.push({
    //       id: entryId,
    //       groupAxisId: xyzId,
    //       axisId: axisIds.join(','),
    //       axisIds: axisIds,
    //       titles: titles,
    //       title: titles.join(' / '),
    //       search: search,
    //     });
    //   });
    //
    //   result.id = xyzId;
    //   result.axisId = cfg;
    //   result.depth = axisIds.length;
    //   result.axisIds = axisIds;
    //
    //   return result;
    // }

    // function makeAxis(xyzId, cfg, data) {
    //   if (!cfg) return [];                                                                          // fake axis
    //   var levels = cfg.split(',');
    //   if (levels.length === 1) return makeOneLevelAxis(xyzId, cfg, data);
    //   return makeGroupAxis('x', subspace.xAxis, data);
    // }
    //
    // var xAxis = subspace.xAxis ? makeAxis('x', subspace.xAxis, data) : [];
    // var yAxis = subspace.xAxis ? makeAxis('y', subspace.yAxis, data) : [];
    // var zAxis = subspace.zAxis ? makeAxis('z', subspace.zAxis, data) : [];
    //
    // result.getXs = function() {
    //   return xAxis;
    // };
    //
    // result.getYs = function() {
    //   return yAxis;
    // };
    //
    // result.getZs = function() {
    //   return zAxis;
    // }

    // var shallowMerge = function (o1, o2) {
    //   var result = {}, key;
    //   for (key in o1) result[key] = o1[key];
    //   for (key in o2) result[key] = o2[key];
    //   return result;
    // }

    // result.data = {
    //   getValue: function (x, y, z) {
    //     var search = {};
    //     if (x && x.search) search = shallowMerge(search, x.search);
    //     if (y && y.search) search = shallowMerge(search, y.search);
    //     if (z && z.search) search = shallowMerge(search, z.search);
    //     var dataEntry = data.find(dataEntry => {
    //       for (var key in search) {
    //         if (search[key] !== dataEntry[key]) return false;
    //       }
    //       return true;
    //     });
    //     if (dataEntry) {
    //       return dataEntry.val;
    //     } else {
    //       return NaN;
    //     }
    //   }
    // };

    return result;
  }


  function _createAxes(axes) {
    var metrics = axes.metrics;
    var locations = axes.locations;
    var periods = axes.periods;
    var units = axes.units;
    var axesOrder = axes.axesOrder;                                                                 // array ['metrics', 'locations', 'periods'] in any order

    if (axes.axesOrderCorrect) {                                                                    // currently axesOrder is inversed, for backward compatibility we have to use axesOrderCorrect as priority version
      axesOrder = axes.axesOrderCorrect;
    } else if (axes.axisOrder) {
      // reverse axisOrder array, as previous bi versions sends it in reversed order: [xAxis, yAxis, zAxis]
      // these older versions also send axisOrder so we can rely on it to check wether we need to reverse order ourselves
      axesOrder = axesOrder.map((item, idx) => axesOrder[axesOrder.length - 1 - idx]);
    }

    var mh = {}, lh = {}, ph = {}, uh = {};
    metrics.forEach(function (m) {
      mh[m.id] = m
    });
    locations.forEach(function (l) {
      lh[l.id] = l
    });
    periods.forEach(function (p) {
      ph[p.id] = p
    });
    units.forEach(function (u) {
      uh[u.id] = u
    });

    var result = {};

    result.getMetrics = function () {
      return metrics;
    };
    result.getLocations = function () {
      return locations;
    };
    result.getPeriods = function () {
      return periods;
    };
    result.getUnits = function () {
      return units;
    };

    result.getMetric = function (id) {
      return mh[id] || null;
    };
    result.getLocation = function (id) {
      return lh[id] || null;
    };
    result.getPeriod = function (id) {
      return ph[id] || null;
    };
    result.getUnit = function (id) {
      return uh[id] || null;
    };

    var _getUnitIdByM = function (m) {
      return ('unit_id' in m) ? m.unit_id : m.dim_id
    };
    result.getUnitByMetric = function (m) {
      return result.getUnit(_getUnitIdByM(m))
    };

    var byAxisName = {
      'metrics': metrics,
      'locations': locations,
      'periods': periods,
      '?': []
    };

    result.getZs = function () {
      return byAxisName[axesOrder[0]]
    };
    result.getYs = function () {
      return byAxisName[axesOrder[1]]
    };
    result.getXs = function () {
      return byAxisName[axesOrder[2]]
    };

    return result;
  }


  var _nalToString = function () {
    var val = this.valueOf();
    if (isNaN(val)) {
      return '-';
    }
    return makeValue(val, this.u);    // u - unit
  };


  //
  // server event listeners
  //
  function _onLoad(data, rawAxes) {
    if (rawAxes.koob) {
      var koobAxes = _createKoobAxes(rawAxes, data);
      return [koobAxes.data, koobAxes];
    }

    var axes = _createAxes(rawAxes);
    var ms = axes.getMetrics();
    var ls = axes.getLocations();
    var ps = axes.getPeriods();

    function _createNAL(v, m, l, p) {
      var nal = (typeof v === "string") ? new String(v) : new Number(v !== null ? v : NaN);
      nal.m = m;
      nal.l = l;
      nal.p = p;
      nal.u = axes.getUnitByMetric(m);
      nal.toString = _nalToString;
      return nal;
    }

    var mlpHash = {};
    data.forEach(function (dataItem) {
      var h = mlpHash, mid = dataItem.metric_id, lid = dataItem.loc_id, pid = dataItem.period_id;
      h = (mid in h) ? h[mid] : (h[mid] = {});
      h = (lid in h) ? h[lid] : (h[lid] = {});
      var value = dataItem.val;

      // deprecated
      if (value == null) {    // null or undefined
        value = dataItem.value;
      }

      h[pid] = _createNAL(value, axes.getMetric(mid), axes.getLocation(lid), axes.getPeriod(pid));
    });

    var _getItemByMLP = function (m, l, p) {
      var h = mlpHash;
      h = (m.id in h) ? h[m.id] : {};
      h = (l.id in h) ? h[l.id] : {};
      h = (p.id in h) ? h[p.id] : null;
      return h;
    };

    var mlpCube = ms.map(function (m) {
      return ls.map(function (l) {
        return ps.map(function (p) {
          var nal = _getItemByMLP(m, l, p);
          if (nal === null) {
            nal = _createNAL(null, m, l, p);
          }
          return nal;
        });
      });
    });

    var _isM = function (e) {
      return ms.indexOf(e) !== -1
    };
    var _isL = function (e) {
      return ls.indexOf(e) !== -1
    };
    var _isP = function (e) {
      return ps.indexOf(e) !== -1
    };

    var _findE = function (isE, z, y, x) {
      return isE(z) && z || isE(y) && y || isE(x) && x || null
    };

    var _findM = function (z, y, x) {
      return _findE(_isM, z, y, x)
    };
    var _findL = function (z, y, x) {
      return _findE(_isL, z, y, x)
    };
    var _findP = function (z, y, x) {
      return _findE(_isP, z, y, x)
    };

    // TODO: skip some values
    mlpCube.getValue = function (z, y, x) {
      var m = _findM(z, y, x);
      var l = _findL(z, y, x);
      var p = _findP(z, y, x);

      if (!m || !l || !p) {
        throw 'Unknown axes coords';
      }

      var mi = ms.indexOf(m);
      var li = ls.indexOf(l);
      var pi = ps.indexOf(p);

      if (mi === -1 || li == -1 || pi == -1) {
        throw 'Unknown axes coords';
      }

      return mlpCube[mi][li][pi];
    };

    return [mlpCube, axes];
  }

  _server.setInterceptor('LOAD', function (payload) {
    return _onLoad(payload.data, payload.axes);                                                     // TODO: + norms
  })
  _server.setInterceptor('LOADING', function (payload) {
    return [_createAxes(payload.axes)];
  });
  _server.setInterceptor('NO_DATA', function (payload) {
    return [_createAxes(payload.axes)];
  });
  _server.setInterceptor('LOAD_DATA', function (payload) {
    return _onLoad(payload.data, payload.axes);                                                     // same format as for LOAD
  });


  //
  // bixel object
  //

  var bixel = {
    invoke: function invoke(messageType, opt) {
      return _server.send(messageType, opt);
    },
    on: function on(evtType, fn) {
      var messageType = evtType.toUpperCase().replace(/-/g, '_');
      _server.addMessageListener(messageType, fn);
      if (evtType !== 'load' && evtType !== 'loading' && evtType !== 'no-data') {
        _server.send('SUBSCRIBE', {topic: evtType});                                                // register subscription
      }
      return bixel;
    },
    off: function off(evtType, fn) {
      var messageType = evtType.toUpperCase().replace(/-/g, '_');
      _server.removeMessageListener(messageType, fn);
      // TODO: if no more listeners: UNSUBSCRIBE
      return bixel;
    },
    // helpers
    init: function init(opt) {
      return this.invoke('INIT', opt);
    }
  };

  return bixel;
});
