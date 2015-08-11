module.exports = {
  friendlyName: 'Disconnect',
  description: 'Disconnect from an Interaction Center server',
  cacheable: false,
  sync: false,
  inputs: { // {{{2
    session: { // {{{3
      example: {
        url: 'https://cic.acme.com:8019/icws',
        id: '1247633034',
        token: 'WAlsaW5lYWRtaW5YC25vZGVqcyB0ZXN0Wab9022567N2OC1kNjZiLTRlMDUtODg1OS05MDg1NDMxOTFjMTNYDTE3Mi4yMi4xNi4xMzxU',
        cookie: 'icws_1247633034=6eabffb3-c873-4161-a777-6edfb6e189ab; Path=/icws/1247633034; HttpOnly',
        icserver: 'cic.acme.com',
      },
      description: 'The Session to disconnect from',
      required: true,
    }, // }}}3
  }, // }}}2
  exits: { // {{{2
    success: { // {{{3
      example: {},
      description: 'Successfully disconnected.',
    }, // }}}3
    missingProperty:    { example: { name: 'property_name', message: 'Human readable error text' } },
    invalidProperty:    { example: { name: 'property_name', message: 'Human readable error text' } },
    deprecatedResource: { example: { name: 'resource_name', message: 'Human readable error text' } },
    sessionNotFound:    { example: { session: {}, message: 'Human readable error text', } },
    missingCookie:      { example: { session: {}, message: 'Human readable error text', } },
    icws_error: { // {{{3
      __type:    'urn:inin.com:errorType',
      errorId:   'error.unknown',
      errorCode: 0,
      message:   'Human readable error text',
    }, // }}}3
    error: { description: 'Unexpected error occured.' },
  }, // }}}2
  fn: function (inputs,exits) // {{{2
  {
    var request = require('request');

    console.log('Disconnecting from session ' + inputs.session.id);
    request.del(
      {
        url: inputs.session.url + '/' + inputs.session.id + '/connection',
        headers: {
          'Accept-Language': 'en-US', // TODO: This should be in the session object
          'ININ-ICWS-CSRF-Token': inputs.session.token,
          'Cookie': inputs.session.cookie,
        }
      },
      function onResponseReceived(error, response, body) {
        if (error)
        {
          return exits.error(error);
        }
        console.log('Status: ' + response.statusCode);
        if (response.statusCode >= 300 || response.StatusCode < 200)
        {
          var error_info = {
            __type:    'urn:inin.com:common:unknownError',
            errorId:   'error.request.unknownError',
            errorCode: -1,
            message:   'Unknown error'
          };

          if (body.length > 0) // TODO: Also check the content-type
          {
            try
            {
              error_info = JSON.parse(body);
            }
            catch(e)
            {
              console.log("Body was not a JSON object.\n" + e);
              error_info.message = body;
            }
          }
          switch(response.statusCode)
          {
            case 400: // Bad Request
              console.log("Error 400: Bad Request\nOriginal error: " + body);
              if (error_info.__type === 'urn:inin.com:common:missingPropertyError')
              {
                return exits.missingProperty({ name: error_info.propertyName, message: error_info.message });
              }
              else if (error_info.errorId === 'error.request.invalidRepresentation.invalidProperty')
              {
                return exits.invalidProperty({ message: error_info.message });
              }
              else
              {
                return exits.icws_error(error_info);
              }
              break;
            case 401: // Unauthorized
              console.log("Error 401: Unauthorized\nOriginal error: " + body);
              var error_info = JSON.parse(body);
              if (error_info.errorCode === 2)
              {
                return exits.sessionNotFound({ session: inputs.session, message: error_info.message });
              }
              else if (error_info.errorCode === 4)
              {
                return exits.missingCookie({ session: inputs.session, message: error_info.message });
              }
              else if (error_info.errorId === "error.request.connection.authenticationFailure" && error_info.errorCode === -2147221499)
              {
                return exits.sessionNotFound({ session: inputs.session, message: error_info.message });
              }
              else
              {
                console.log('Error code: ' + error_info.errorCode);
                return exits.icws_error(error_info);
              }
              break;
            case 404: // Not Found
              console.log("Error 404: Not Found");
              return exits.sessionNotFound({ session: inputs.session, message: 'The session was not found' });
              break;
            case 410: // Gone
              console.log("Error 410: Gone\nOriginal error: " + body);
              return exits.deprecatedResource({ name: 'disconnect', message: error_info.message });
              break;
            case 500: // Internal Server Error
              console.log("Error 500: Internal Server Error\nOriginal error: " + body);
              return exits.icws_error(error_info);
              break;
            case 503: // Service Unavailable
              console.log("Error 503: Service Unavailable\nOriginal error: " + JSON.stringify(body));
              if (error_info.errorId === 'error.server.notAcceptingConnections')
              {
                console.log('server ' + inputs.server + ' is not accepting connections. Alternates: [' + error_info.alternateHostList.join() + ']');
                return exits.notAcceptingConnections({ alternateHosts: error_info.alternateHostList, message: error_info.message });
              }
              else if (error_info.errorId === 'error.server.unavailable')
              {
                console.log('server ' + inputs.server + ' is not available. Alternates: [' + error_info.alternateHostList.join() + ']');
                return exits.serverUnavailable({ alternateHosts: error_info.alternateHostList, message: error_info.message });
              }
              else
              {
                console.log('Unknown error ' + response.statusCode + ' when connecting to server ' + server);
                return exits.icws_error(error_info);
              }
              break;
            default: // Other errors
              console.log("Error " + response.statusCode + "\nOriginal error: " + JSON.stringify(body));
              return exits.error(body);
          }
        }
        console.log('Disconnected from session ' + inputs.session.id);
        return exits.success({});
      }
    );
  }, // }}}2
};
