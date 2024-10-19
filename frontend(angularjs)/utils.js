// Function to decode a JWT token
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(function (c) {
          return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        })
        .join('')
    );

    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

// Check if the token is expired
function isTokenExpired(token) {
  if (!token) return true; // If no token, it's considered expired

  const decodedToken = parseJwt(token);
  if (!decodedToken || !decodedToken.exp) return true; // Invalid token format

  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  return decodedToken.exp < currentTime; // True if the token is expired
}

// Function to refresh the short token using the long token
function refreshShortToken(http, location) {
  const longToken = localStorage.getItem('longToken');

  return http
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
      location.path('/login');
      return null;
    });
}

