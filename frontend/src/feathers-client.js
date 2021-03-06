import feathers from '@feathersjs/feathers'
import socketio from '@feathersjs/socketio-client'
import io from 'socket.io-client'
import feathersVuex from 'feathers-vuex'

let apiKey = localStorage.getItem('display-api-key');
if (!apiKey || apiKey === '') {
    // Make sure the header is not empty, so it gets sent and the authentication process kicks in
    apiKey = 'none'
}
let options = {
    transportOptions: {
        polling: {
            extraHeaders: {
                'x-api-key': apiKey
            }
        }
    }
};

const socket = io(options)

const feathersClient = feathers()
  .configure(socketio(socket))

export default feathersClient

// Setting up feathers-vuex
const { makeServicePlugin, BaseModel, models, FeathersVuex } = feathersVuex(
  feathersClient,
  {
    serverAlias: 'api',
    idField: 'id',
    whitelist: ['$regex', '$options']
  }
)

export { makeServicePlugin, BaseModel, models, FeathersVuex }
