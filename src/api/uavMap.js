import { BASE_URL, request, handleResponse } from './request.js'

export function getUavMapData() {
  return request(`${BASE_URL}/uav/flight/path`, {
    method: 'GET'
  }).then(handleResponse)
}