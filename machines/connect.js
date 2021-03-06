module.exports = { // {{{
  friendlyName: 'Connect',
  description: 'Connect to an Interaction Center® server',
  cacheable: false,
  sync: false,
  inputs: { // {{{2
    protocol: { // {{{3
      example: 'https',
      description: 'The protocol (http, https) to use to connect to the Interaction Center server',
      required: false
    }, // }}}3
    server: { // {{{3
      example: 'cic.acme.com',
      description: 'The Interaction Center server to connect to',
      required: true
    }, // }}}3
    port: { // {{{3
      example: 8019,
      description: 'The Interaction Center port to connect to',
      required: false
    }, // }}}3
    applicationName: { // {{{3
      example: 'My Client Application',
      description: 'Associate the given Application to a Session',
      required: true
    }, // }}}3
    userID: { // {{{3
      example: 'operator',
      description: 'The Interaction Center user ID to log in with',
      required: true
    }, // }}}3
    password: { // {{{3
      example: '1234',
      description: 'The Interaction Center password for the supplied user ID',
      required: true
    }, // }}}3
    marketPlaceApplicationLicenseName: { // {{{3
      example: 'ACME',
      description: "The Interactive Intelligence application's license name",
      required: false
    }, // }}}3
    marketPlaceApplicationCode: { // {{{3
      example: '{{UUID}}',
      description: "The Interactive Intelligence application code",
      required: false
    }, // }}}3
    language: { // {{{3
    example: 'en-US',
      description: "The language to use with the Interaction Center server",
      required: false
    }, // }}}3
  }, // 2}}}
  exits: { // {{{2
    success: { // {{{3
      example: {
        url:            'url to use',
        icserver:       'the connected Interaction Center server',
        id:             '{{A session identifier}}',
        token:          '{{A complex blob string}}', 
        cookie:         '{{A web cookie}}',
        alternateHosts: ['server1', 'server2' ],
        user:           { id: 'userid', display: 'display name' },
        language:       'en-US',
      },
    }, // }}}3
    missingProperty:         { example: { name: 'property_name', message: 'Human readable error text' } },
    invalidProperty:         { example: { name: 'property_name', message: 'Human readable error text' } },
    deprecatedResource:      { example: { name: 'resource_name', message: 'Human readable error text' } },
    notAcceptingConnections: { example: { alternateHosts: ['server1', 'server2'], message: 'Human readable error text' }, },
    serverUnavailable:       { example: { alternateHosts: ['server1', 'server2'], message: 'Human readable error text' }, },
    icws_error: { // {{{3
      __type:    'urn:inin.com:errorType',
      errorId:   'error.unknown',
      errorCode: 0,
      message:   'Human readable error text',
    }, // }}}3
    error: { description: 'Unexpected error occured.' },
  }, // }}}2
  fn: function (inputs,exits) { // {{{2
    var request = require('request');

    // validate inputs and set defaults
    inputs.protocol = (inputs.protocol || 'https').toLowerCase();
    if (inputs.protocol !== 'http' && inputs.protocol !== 'https')
    {
      return exits.invalidProperty({name: 'protocol', message: 'protocol is invalid. Valid values are: http, https' });
    }
    inputs.port     = inputs.port || (inputs.protocol === 'http' ? 8018 : 8019);
    inputs.language = inputs.language || 'en-US'; // TODO: if language is null => system language?!?

    //if (inputs.marketPlaceApplicationLicenseName.length > 0)

    console.log('Connecting to ' + inputs.server + ' as ' + inputs.userID);

    request.post(
      {
        url:     inputs.protocol + '://' + inputs.server + ':' + inputs.port + '/icws/connection',
        headers: {
          'Accept-Language': inputs.language,
        },
        json: {
          __type:          'urn:inin.com:connection:icAuthConnectionRequestSettings',
          applicationName: inputs.applicationName,
          userID:          inputs.userID,
          password:        inputs.password,
          marketPlaceApplicationLicenseName: inputs.market_license,
          marketPlaceApplicationCode:        inputs.market_code,
        },
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
              return exits.error(error_info);
          }
        }
        console.log('Connected to ' + inputs.server + ' as ' + body.userID);
        for (i=0; i < response.headers['set-cookie'].length; i++)
        {
          var cookie = response.headers['set-cookie'][i];

          if (cookie.search(/^icws_/) > -1)
          {
          console.log('>> ' + JSON.stringify(body));
            return exits.success({
              url:            inputs.protocol + '://' + inputs.server + ':' + inputs.port + '/icws',
              icserver:       body.icServer,
              id:             body.sessionId,
              token:          body.csrfToken,
              cookie:         cookie,
              alternateHosts: body.alternateHostList,
              user:           { id: body.userID, display: body.userDisplayName },
              language:       inputs.language,
            });
          }
        }
        return exits.error({ message: 'Missing ICWS Cookie in response' });
      }
    );
  }, // }}}
}; // }}}
