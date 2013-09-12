'use strict';

angular.module('solace.controllers', []).
    controller('MainCtrl', function ($scope, $rootScope, $location, SessionFactory) {
        $scope.session = SessionFactory.get(function (session){
            $rootScope.$broadcast('$sessionUpdate', session);
        });

        $scope.$on('$sessionUpdate', function (e, newSession) {
            $scope.session = newSession;
            if (!$scope.session.loggedIn)
                $location.path('/login');
        });

        $scope.$on('$accessDenied', function (e) {
            SessionFactory.get(function (session) {
                $rootScope.$broadcast('$sessionUpdate', session);
            });
        });
    }).

    controller('MenuLeftCtrl', function ($scope, $location, $route) {
        $scope.menuitems = [
            {title: "Dashboard", link: "#/dashboard", section: "dashboard", active: "", icon: "glyphicon glyphicon-stats"},
            {title: "Experiments", link: "#/experiments", section: "experiments", active: "", icon: "glyphicon glyphicon-tasks"},
        ];

        function update_active() {
            angular.forEach($scope.menuitems, function (item) {
                if (item.section === $route.current.section)
                    item.active = "active";
                else
                    item.active = "";
            });
        }
        $scope.$on("$routeChangeSuccess", update_active);
        update_active();
    }).

    controller('NavBarCtrl', function ($scope, $rootScope, $location, SessionFactory) {
        $scope.loading = false;
        $scope.errorMessage = "";
        $scope.showError = false;

        $scope.$on("$routeChangeStart", function(event, next, current) {
                $scope.loading = true;
                $scope.showError = false;
            }
        );
        $scope.$on("$routeChangeSuccess", function(event, current, previous) {
                $scope.loading = false;
                $scope.showError = false;
            }
        );
        $scope.$on("$routeChangeError", function(event, current, previous, message) {
                $scope.loading = false;
                $scope.errorMessage = message;
                $scope.showError = true;
            }
        );

        $scope.closeError = function () {
            $scope.showError = false;
        }

        $scope.logout = function () {
            SessionFactory.delete(function(session) {
                $rootScope.$broadcast('$sessionUpdate', session);
            });
        }
    }).

    controller('DashboardCtrl', function ($scope) {
    }).

    controller('ExperimentsCtrl', function ($scope, $route, experiments, ExperimentsFactory) {
        $scope.experiments = experiments;

        $scope.toggleSelection = function (exp) {
            exp.sel = !exp.sel;
            $scope.selectAll = false;
        }

        $scope.selectAll = false;
        $scope.toggleSelectionAll = function () {
            $scope.selectAll = !$scope.selectAll;

            angular.forEach($scope.experiments, function (exp) {
                exp.sel = $scope.selectAll;
            });
        }

        $scope.removeSelected = function () {
            angular.forEach($scope.experiments, function(exp) {
                if (exp.sel)
                    experimentsFactory.delete(exp);
            });
        }

        $scope.new = {
            doShow: false,
            doShowLoading: false,
            doShowError: false,

            name: {value: "", class: ""},
            desc: {value: "", class: ""},

            error: "",

            show: function () {
                $scope.new.name.value = "";
                $scope.new.name.class = "";
                $scope.new.desc.value = "";
                $scope.new.desc.class = "";
                $scope.new.doShowError = false;
                $scope.new.doShowLoading = false;
                $scope.new.doShow = true;
            },
            hide: function () {
                $scope.new.doShow = false;
            },
            save: function () {
                $scope.new.doShowError = false;
                $scope.new.doShowLoading = true;

                if ($scope.new.name.value === '') {
                    $scope.new.name.class = "has-error";
                    $scope.new.doShowLoading = false;
                    return;
                }
                $scope.new.name.class = "";

                var exp = {
                    name: $scope.new.name.value,
                    description: $scope.new.desc.value
                };

                ExperimentsFactory.save(exp,
                    function (success) {
                        $scope.new.hide();
                        $route.reload();
                    }, function (error) {
                        $scope.new.error = reason;
                        $scope.new.doShowError = true;
                        $scope.new.doShowLoading = false;
                    }
                );
            }
        };
    }).

    controller('ExperimentCtrl', function ($scope, $routeParams, ExperimentFactory) {
        $scope.experiment = ExperimentFactory.get({id: $routeParams.id});
    }).

    controller('InstanceCtrl', function ($scope, $routeParams, InstanceFactory) {
        $scope.instance = InstanceFactory.get({id: $routeParams.id});

        $scope.showParameterBox = false;
        $scope.toggleParameterBox = function() {
            $scope.showParameterBox = !$scope.showParameterBox;
        };
    }).

    controller('RunCtrl', function ($scope, $routeParams, RunFactory, ResultFactory) {
        $scope.run = RunFactory.get({id: $routeParams.id}, function () {
            angular.forEach($scope.run.resultVariables, function (res) {
                if ((res.type == 'integer') || (res.type == 'real')) {
                    var r = ResultFactory.get({id: $routeParams.id, name: res.name}, function () {
                        $scope.chart.addSeries({
                            name: res.name,
                            data: (function () {
                                var ret = [];
                                for (var i=0; i<r.data.length; i++)
                                    ret.push([new Date(r.data[i][0]).getTime(), parseFloat(r.data[i][1])]);
                                return ret;
                            })()
                        });
                    });
                }
            });
        });

        $scope.chart = function (element) {
            return new Highcharts.Chart({
                chart: { renderTo: element[0] },
                title: { text: 'Results' },
                xAxis: { type: 'datetime' },
                series: []
            });
        };
    }).

    controller('LoginCtrl', function ($scope, $rootScope, $location, SessionFactory) {
        $scope.user = {};
        $scope.showLoading = false;
        $scope.showError = false;
        $scope.errorMessage = "";

        $scope.login = function () {
            $scope.showLoading = true;
            $scope.showError = false;

            SessionFactory.save($scope.user, function(session) {
                $rootScope.$broadcast('$sessionUpdate', session);
                $location.path('/');
                $scope.showLoading = false;
            }, function(error) {
                $scope.errorMessage = error;
                $scope.showError = true;
                $scope.showLoading = false;
            });
        };
    });