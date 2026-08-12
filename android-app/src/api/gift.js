// 礼品 & 兑换 API
import apiClient from './client';

export const giftApi = {
  /** 获取礼品列表（公开） */
  getList: (params) => apiClient.get('/gifts/list', { params }),

  /** 兑换礼品 */
  exchange: (giftId, quantity = 1) =>
    apiClient.post('/gifts/exchange', { giftId, quantity }),

  /** 获取兑换记录 */
  getExchangeRecords: (params) =>
    apiClient.get('/gifts/exchange-records', { params }),

  /** 获取礼品详情 */
  getDetail: (id) => apiClient.get(`/gifts/${id}`),
};