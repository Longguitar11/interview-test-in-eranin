const app = angular.module('myApp', ['ngRoute']);
const baseUrl = 'http://localhost:3000';

// Configure routes
app.config(function ($routeProvider) {
  $routeProvider
    .when('/login', {
      templateUrl: 'login.html',
      controller: 'LoginController',
    })
    .when('/home', {
      templateUrl: 'home.html',
      controller: 'HomeController',
    })
    .otherwise({
      redirectTo: '/login',
    });
});

// Auth Guard: Protect routes
app.run(function ($rootScope, $location) {
  $rootScope.$on('$routeChangeStart', function (event, next, current) {
    const token = sessionStorage.getItem('shortToken');

    console.log(next.$$route.originalPath);

    // If navigating to the home page, check if the token is valid
    if (next.$$route.originalPath === '/home') {
      if (!token || isTokenExpired(token)) {
        // Token is missing or expired, redirect to login
        event.preventDefault();
        alert('Your session has expired, please log in again.');
        $location.path('/login');
      }
    }
  });
});

app.controller('LoginController', function ($scope, $http, $location) {
  $scope.username = ''; // Initialize username
  $scope.password = ''; // Initialize password
  $scope.otp = ''; // Initialize OTP

  $scope.login = function () {
    $http
      .post(baseUrl + '/login', {
        username: $scope.username,
        password: $scope.password,
      })
      .then(function (response) {
        if (response.data.mfaRequired) {
          $scope.mfaRequired = true;
          $scope.username = response.data.username;

          // If MFA is not set up, generate a QR code for first-time setup
          if (!response.data.mfaEnabled) {
            $http
              .post(baseUrl + '/setup-mfa', { username: $scope.username })
              .then(function (qrResponse) {
                $scope.qrCodeUrl = qrResponse.data.qrCodeUrl;
                $scope.firstTimeMFA = true;
              });
          }
        }
      });
  };

  $scope.verifyMFA = function () {
    console.log($scope.username, $scope.otp);

    $http
      .post(baseUrl + '/verify-mfa', {
        username: $scope.username,
        mfaCode: $scope.otp,
      })
      .then(function (response) {
        if (response.data.success) {
          sessionStorage.setItem('shortToken', response.data.shortToken);
          localStorage.setItem('longToken', response.data.longToken);
          $location.path('/home');
        } else {
          alert('Invalid OTP');
        }
      })
      .catch(function (error) {
        console.error('Error during MFA verification:', error.data);
        alert('An error occurred during verification. Please try again.');
      });
  };
});

app.controller('HomeController', function ($scope, $http, $location) {
  // Function to refresh the short token using the long token
  function refreshShortToken() {
    const longToken = localStorage.getItem('longToken');

    return $http
      .post(baseUrl + '/refresh-token', { longToken: longToken })
      .then(function (response) {
        sessionStorage.setItem('shortToken', response.data.shortToken);
        return response.data.shortToken;
      })
      .catch(function (error) {
        // If long token is expired, log the user out
        console.log('Long token expired. User must log in again.');
        sessionStorage.removeItem('shortToken');
        localStorage.removeItem('longToken');
        alert('Your session has expired, please log in again.');
        $location.path('/login');
        return null;
      });
  }

  // Modify HTTP request to check for token expiration and refresh if necessary
  function makeAuthenticatedRequest(config) {
    const shortToken = sessionStorage.getItem('shortToken');

    if (!shortToken || isTokenExpired(shortToken)) {
      // Short token is missing or expired, refresh it
      refreshShortToken().then(function (newShortToken) {
        if (newShortToken) {
          config.headers.Authorization = 'Bearer ' + newShortToken;
          return $http(config); // Make the original request after token refresh
        }
      });
    } else {
      // Token is still valid, proceed with the request
      config.headers.Authorization = 'Bearer ' + shortToken;
      return $http(config);
    }
  }

  $scope.disableMFA = function () {
    makeAuthenticatedRequest({
      method: 'POST',
      url: baseUrl + '/disable-mfa',
      headers: {},
    })
      .then(function (response) {
        if (response.data.success) {
          alert('MFA disabled');
        }
      })
      .catch(function (error) {
        if (error.status === 401) {
          // Token expired, redirect to login
          alert('Your session has expired, please log in again.');
          $location.path('/login');
        }
      });
  };

  $scope.logout = function () {
    sessionStorage.removeItem('shortToken');
    localStorage.removeItem('longToken');
    $location.path('/login');
  };
});
