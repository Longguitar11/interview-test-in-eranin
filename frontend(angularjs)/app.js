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
app.run(function ($rootScope, $location, $http) {
  $rootScope.$on('$routeChangeStart', function (event, next, current) {
    const token = sessionStorage.getItem('shortToken');

    console.log(next.$$route.originalPath);

    // If navigating to the home page, check if the token is valid
    if (next.$$route.originalPath === '/home') {
      if (!token || isTokenExpired(token)) {
        // Prevent navigation until token is refreshed or user is redirected
        event.preventDefault();

        // Try to refresh the short token using the long token
        refreshShortToken($http, $location).then(function (newToken) {
          if (newToken) {
            console.log('refresh token and navigate to home');
            // If token refresh was successful, proceed to the home page
            $location.path('/home');
          }
        });
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
  // Modify HTTP request to check for token expiration and refresh if necessary
  function makeAuthenticatedRequest(config, http) {
    const shortToken = sessionStorage.getItem('shortToken');

    if (!shortToken || isTokenExpired(shortToken)) {
      // Short token is missing or expired, refresh it
      refreshShortToken($http, $location).then(function (newShortToken) {
        if (newShortToken) {
          console.log('refresh and call function');
          config.headers.Authorization = 'Bearer ' + newShortToken;
          return $http(config); // Make the original request after token refresh
        } else {
          // If no new token was returned, reject the promise
          return Promise.reject('Failed to refresh short token');
        }
      });
    } else {
      // Token is still valid, proceed with the request
      config.headers.Authorization = 'Bearer ' + shortToken;
      return $http(config);
    }
  }

  // Fetch the username using makeAuthenticatedRequest
  makeAuthenticatedRequest({
    method: 'GET',
    url: baseUrl + '/get-username',
    headers: {},
  })
    .then(function (response) {
      $scope.username = response.data.username; // Store the username in $scope
    })
    .catch(function (error) {
      if (error.status === 401) {
        alert('Your session has expired, please log in again.');
        $location.path('/login');
      }
    });

  $scope.disableMFA = function () {
    makeAuthenticatedRequest({
      method: 'POST',
      url: baseUrl + '/disable-mfa',
      headers: {},
    })
      .then(function (response) {
        console.log({ response });
        if (response.data.success) {
          alert('MFA disabled');
        }
      })
      .catch(function (error) {
        if (error.status === 401) {
          // Token expired, redirect to login
          alert('Your session has expired, please log in again.');
          $location.path('/login');
        } else {
          console.error('Error disabling MFA:', error);
          alert('An error occurred while disabling MFA.');
        }
      });
  };

  $scope.logout = function () {
    sessionStorage.removeItem('shortToken');
    localStorage.removeItem('longToken');
    $location.path('/login');
  };
});
