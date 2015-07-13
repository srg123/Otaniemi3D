'use strict';

/**
 * @ngdoc directive
 * @name otaniemi3dApp.directive:sensorTree
 * @description
 * # sensorTree
 */
angular.module('otaniemi3dApp')
  .directive('sensorTree', function ($document, $http, SensorData) {
    return {
      template: '<div></div>',
      restrict: 'E',
      require: 'ngModel',
      scope: {
        selectSensor: '=',
        addSensor: '=',
        search: '=',
        root: '='
      },
      link: function postLink (scope, element, attrs, ngModel) {

        element.jstree({
          plugins: ['search', 'sort', 'dnd'],
          core: {
            check_callback: true,
            worker: false,
            data: function (node, cb) {
              var children = [],
                  error = [{
                    text: 'Error. Close and reopen this node to try again.'
                  }];

              if (node.id === '#') {
                var id = scope.root.split('/'),
                    icon,
                    type;
                id = id[id.length-1].length ? id[id.length-1] : id[id.length-2];

                //TODO: data from server should have type as a metadata
                if (id === 'K1') {
                  icon = 'images/icon-building.svg';
                  type = 'building';
                } else {
                  icon = 'images/icon-room.svg';
                  type = 'room';
                }

                children = [{
                  id: id,
                  text: id.split('-').join(' '),
                  children: true,
                  type: type,
                  icon: icon
                }];

                cb.call(this, children);

              } else if (node.original.type === 'sensor') {
                $http.get(node.original.url).success(function (data) {
                  var values = SensorData.parseInfoItem(data);

                  if (values.length) {
                    children = [{
                      values: values,
                      text: values[0].value + '  --  ' +
                        values[0].time.toISOString(),
                      icon: false,
                      type: 'value'
                    }];
                  }

                  cb.call(this, children);
                })
                .error(function () {
                  cb.call(this, error);
                });

              } else if (node.original.type === 'room') {
                $http.get(scope.root + node.id).success(function (data) {
                  var room = SensorData.parseObject(data);

                  for (var i = 0; i < room.infoItems.length; i++) {
                    var id = room.infoItems[i];

                    children.push({
                      id: id + '-' + node.id,
                      room: room.id,
                      name: id,
                      text: id.charAt(0).toUpperCase() + id.slice(1),
                      children: true,
                      icon: 'images/icon-' + id + '.svg',
                      type: 'sensor',
                      url: scope.root + node.id + '/' + id
                    });
                  }
                  cb.call(this, children);
                })
                .error(function () {
                  cb.call(this, error);
                });

              } else if (node.original.type === 'building') {
                $http.get(scope.root).success(function (data) {
                  var building = SensorData.parseObject(data);

                  for (var i = 0; i < building.objects.length; i++) {
                    var id = building.objects[i];

                    children.push({
                      id: id,
                      text: id.split('-').join(' '),
                      children: true,
                      icon: 'images/icon-room.svg',
                      type: 'room',
                      url: scope.root + id
                    });
                  }
                  cb.call(this, children);
                })
                .error(function () {
                  cb.call(this, error);
                  node.children = true;
                });
              }
            },
            themes: {
              responsive: true
            }
          },
          search: {
            show_only_matches: true,
            show_only_matches_children: true
          },
          dnd: {
            is_draggable: function (nodes) {
              var node = nodes[0];
              return node.original.type === 'sensor';
            }
          }
        });

        var tree = element.jstree(true);

        function getNode(node, original) {
          if (!original) {
            return tree.get_node(node);
          } else {
            return tree.get_node(node).original;
          }
        }

        element
          /*.on('select_node.jstree', function (_, data) {
            if (data.event) {
              var node = data.node,
                  room,
                  sensor;

              switch (node.original.type) {
                case 'sensor':
                  node.state.opened = true;
                  room = getNode(node.parent);
                  sensor = node;
                  break;
                case 'value':
                  room = getNode(node.parents[1]);
                  sensor = getNode(node.parent);
                  break;
                default:
                  return;
              }

              //Use $apply because jstree works outside of angular's scope
              scope.$apply(scope.selectSensor(room, sensor));
            }
          })*/
          .on('after_close.jstree', function (_, data) {
            data.node.children = true;
            getNode(data.node.id).state.loaded = false;
          });

        $document
          .on('dnd_stop.vakata', function (_, data) {
            var target = $(data.event.target);
            if(target.closest('#drop-area').length) {
              var sensor = getNode(data.data.nodes[0]);
              var room = getNode(sensor.parent);
              scope.addSensor(room, sensor);
            }
          })
          .on('dnd_move.vakata', function (_, data) {
            var target = $(data.event.target);
            if(!target.closest(element).length) {
              if(target.closest('#drop-area').length) {
                data.helper.find('.jstree-icon')
                  .removeClass('jstree-er')
                  .addClass('jstree-ok');
              }
              else {
                data.helper.find('.jstree-icon')
                  .removeClass('jstree-ok')
                  .addClass('jstree-er');
              }
            }
          });

        scope.$watch('search', function (str) {
          tree.search(str);
        });

        scope.$on('$destroy', function () {
          $.jstree.destroy();
          $document.off('dnd_stop.vakata dnd_move.vakata');
        });
      }
    };
  });
