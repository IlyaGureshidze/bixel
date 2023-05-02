# bixel - BI external element


## Usage

1. Download `bixel.js` or install with bower
- Create html file (index.html)
- Attach bixel.js as script or through require.js
- add event handlers (`loading`, `load`, `no-data`, etc)
- execute ```bixel.init()``` with options described below

## Direct
- include ```  <script src="https://cdn.jsdelivr.net/gh/luxms/bixel@master/bixel.js"></script>``` in your html file

## Using Bower
- run ```bower install git://github.com/luxms/bixel```
- include ```<script src="bower_components/bixel/bixel.js"></script>``` in your html file

## Using require.js
TODO

# API
## bixel.init

```
bixel.init({optional config})
```

Must execute this function when frame is ready to receive message

Config (optional):
- `locationsCount: string` - number of requested locations
- `metricsCount: string` - number of requested metrics
- `periodsCount: string` - number of requested periods
- `xsCount: string` number of entities of x-axis (e.g. periods, locations, metrics - one projected on x-axis)
- `ysCount: string` number of entities of y-axis
- `zsCount: string` number of entities of z-axis
- `saveAbilities: string[]` - array of file extensions that vizel can be saved to

If none expliced then all selected will be provided

`bixel.init` returns promise object to ensure that everything is working
```javascript
bixel.init({periodsCount:1})
    .then(function() {
      // succeeded
    }, function() {
      // error
    });
```

## bixel.on
subscribe on event
(receive event from client)
```
bixel.on(eventName, callbackFunction)
```
eventName is string and can be one of:
- `loading` - will receive this event when data is loading. A callback will
  have `Axis` object as the only argument
- `load` - will receive this event when data is loading. A callback will
  have `Data` and `Axis` object as two arguments
- `no-data`- will receive this event when the data is empty if either there is
   no selection in ui panes or no data on server side. A callback will have
   `Axis` object as the only argument
- `save` - when user click on save button
- `url` - will receive this event when url changed. It provides callback argument as current model of UrlState service

## bixel.invoke
trigger the event manually (send event to client).

Available keys for event:
- `LOAD` - default event for receiving data
- `LOADING` - event for loading state of dashlet
- `NO_DATA` - event for state of no data from server
- `LOAD_DATA` - get raw data from server
- `CLICK_DATA_POINT` - click on data point


Examples:
```
bixel.invoke('LOAD_DATA', {
  metrics: [34, 56, 61],
  locations: [19001],
  periods: [202001010000004]
}).then(function(data) {
 console.log(data);
}
```
``` 
$(document).on('click', '[data-yId]', function(event){
  bixel.invoke('CLICK_DATA_POINT', { x_id: X.id, y_id: event.target.getAttribute('data-yId'), z_id: Z.id, event: {pageX: event.pageX, pageY: event.pageY } });
});
```
## Axis object
provides methods:
- `axis.getMetrics()` - returns javascript array of `Metric` objects. This array
  will be maximum of `metricsCount` length if specified in `bixel.init` method
- `axis.getLocations()` - returns javascript array of `Location` objects. This array
  will be maximum of `locationsCount` length if specified in `bixel.init` method
- `axis.getPeriods()` - returns javascript array of `Period` objects. This array
  will be maximum of `periodsCount` length if specified in `bixel.init` method
- `axis.getUnits()` returns javascript array of `Unit` objects. It will
  contain all the units linked with metrics


- `axis.getXs()` - returns javascript array of entities of x-axis. This array
    will be maximum of `xsCount` length if specified in `bixel.init` method
- `axis.getYs()` - returns javascript array of entities of y-axis. This array
  will be maximum of `ysCount` length if specified in `bixel.init` method
- `axis.getZs()` - returns javascript array of entities of z-axis. This array
  will be maximum of `zsCount` length if specified in `bixel.init` method

## Data object
provides methods:
- `data.getValue(z, y, x)` - returns `DataItem` object. Arguments `z`, `y` and
   `x` are  `Metric`, `Location` and `Period` objects from Axis in any order (or elements of zs, ys, xs).

## DataItem
Generally a javascript `Number` object with overridden `toString` method.
`toString` will return formatted value according to measure unit.

example:
```javascript
bixel.on('load', function(data, axis) {
  var metric = axis.getMetrics()[0];     // only the first metric of provided
  var location = axis.getLocations()[0]; // and first location
  var period = axis.getPeriods()[0];     // and first period

  var x = axis.getXs()[0];     // first element of X axis
  var y = axis.getYs()[0];     // and first element of Y axis
  var z = axis.getZs()[0];     // and first element on Z axis (can be undefined)

  var dataValue = data.getValue(metric, location, period);
  // dataValue = data.getValue(z, y, x)

  var numValue = dataValue.valueOf();    // ex: number, 1000000
  var strValue = dataValue.toString()    // ex: string, '$ 1 000 000 us dollars'
});
```


## Metric object
javascript object, has fields:
- `id`:string - unique id of metric
- `title`:string - title of metric
- `color`:string - color for this metric according to dash configuration
- `unit_id`: string - the id of unit linked to the metric

## Location object
javascript object, has fields:
- `id`:string - unique id of location
- `title`:string - title of location
- `color`:string - color for this location according to dash configuration

## Period object
javascript object, has fields:
- `id`:string - unique id of period
- `title`:string - title of period
- `color`:string - color for this period according to dash configuration

## Entity object (any element from ys, xs, zs)
javascript object of IEntity type, has fields:
- `id`:string - unique id of entity
- `title`:string - title of entity
- `color`:string - color for this entity according to dash configuration
- `axisId`?: string - id of elements on axis ("measures", "locations", "age" (some dimension id));
- `ids`?: Array<string | number> - array of ids of elements on axis ;
- `titles`?: string[] - array of titles of elements on axis ;
- `axisIds`?: string[] - array of axisIds of elements on axis ;
- `config`?: any - usual js object to hold any info you might need;
