/* eslint-disable */
/* tslint:disable */
// @ts-nocheck
/*
 * ---------------------------------------------------------------
 * ## THIS FILE WAS GENERATED VIA SWAGGER-TYPESCRIPT-API        ##
 * ##                                                           ##
 * ## AUTHOR: acacode                                           ##
 * ## SOURCE: https://github.com/acacode/swagger-typescript-api ##
 * ---------------------------------------------------------------
 */

import httpRequest, { ContentType, RequestParams } from "./httpClient";
import {
  DomainPWResponse,
  GetShareProV1OpenapiCasCallbackParams,
  GetShareProV1OpenapiDingtalkCallbackParams,
  GetShareProV1OpenapiFeishuCallbackParams,
  GetShareProV1OpenapiGithubCallbackParams,
  GetShareProV1OpenapiOauthCallbackParams,
  GetShareProV1OpenapiWecomCallbackParams,
  GithubComOrionPlatformOrionKnowledgeProApiShareV1CASCallbackResp,
  GithubComOrionPlatformOrionKnowledgeProApiShareV1DingtalkCallbackResp,
  GithubComOrionPlatformOrionKnowledgeProApiShareV1FeishuCallbackResp,
  GithubComOrionPlatformOrionKnowledgeProApiShareV1GitHubCallbackResp,
  GithubComOrionPlatformOrionKnowledgeProApiShareV1OAuthCallbackResp,
  GithubComOrionPlatformOrionKnowledgeProApiShareV1WecomCallbackResp,
} from "./types";

/**
 * @description CAS回调
 *
 * @tags ShareOpenapi
 * @name GetShareProV1OpenapiCasCallback
 * @summary CAS回调
 * @request GET:/share/pro/v1/openapi/cas/callback
 * @response `200` `(DomainPWResponse & {
    data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1CASCallbackResp,

})` OK
 */

export const getShareProV1OpenapiCasCallback = (
  query: GetShareProV1OpenapiCasCallbackParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1CASCallbackResp;
    }
  >({
    path: `/share/pro/v1/openapi/cas/callback`,
    method: "GET",
    query: query,
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description dingtalk回调
 *
 * @tags ShareOpenapi
 * @name GetShareProV1OpenapiDingtalkCallback
 * @summary dingtalk回调
 * @request GET:/share/pro/v1/openapi/dingtalk/callback
 * @response `200` `(DomainPWResponse & {
    data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1DingtalkCallbackResp,

})` OK
 */

export const getShareProV1OpenapiDingtalkCallback = (
  query: GetShareProV1OpenapiDingtalkCallbackParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1DingtalkCallbackResp;
    }
  >({
    path: `/share/pro/v1/openapi/dingtalk/callback`,
    method: "GET",
    query: query,
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description feishu回调
 *
 * @tags ShareOpenapi
 * @name GetShareProV1OpenapiFeishuCallback
 * @summary feishu回调
 * @request GET:/share/pro/v1/openapi/feishu/callback
 * @response `200` `(DomainPWResponse & {
    data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1FeishuCallbackResp,

})` OK
 */

export const getShareProV1OpenapiFeishuCallback = (
  query: GetShareProV1OpenapiFeishuCallbackParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1FeishuCallbackResp;
    }
  >({
    path: `/share/pro/v1/openapi/feishu/callback`,
    method: "GET",
    query: query,
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description GitHub回调
 *
 * @tags ShareOpenapi
 * @name GetShareProV1OpenapiGithubCallback
 * @summary GitHub回调
 * @request GET:/share/pro/v1/openapi/github/callback
 * @response `200` `(DomainPWResponse & {
    data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1GitHubCallbackResp,

})` OK
 */

export const getShareProV1OpenapiGithubCallback = (
  query: GetShareProV1OpenapiGithubCallbackParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1GitHubCallbackResp;
    }
  >({
    path: `/share/pro/v1/openapi/github/callback`,
    method: "GET",
    query: query,
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description OAuth回调
 *
 * @tags ShareOpenapi
 * @name GetShareProV1OpenapiOauthCallback
 * @summary OAuth回调
 * @request GET:/share/pro/v1/openapi/oauth/callback
 * @response `200` `(DomainPWResponse & {
    data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1OAuthCallbackResp,

})` OK
 */

export const getShareProV1OpenapiOauthCallback = (
  query: GetShareProV1OpenapiOauthCallbackParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1OAuthCallbackResp;
    }
  >({
    path: `/share/pro/v1/openapi/oauth/callback`,
    method: "GET",
    query: query,
    type: ContentType.Json,
    format: "json",
    ...params,
  });

/**
 * @description 企业微信回调
 *
 * @tags ShareOpenapi
 * @name GetShareProV1OpenapiWecomCallback
 * @summary 企业微信回调
 * @request GET:/share/pro/v1/openapi/wecom/callback
 * @response `200` `(DomainPWResponse & {
    data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1WecomCallbackResp,

})` OK
 */

export const getShareProV1OpenapiWecomCallback = (
  query: GetShareProV1OpenapiWecomCallbackParams,
  params: RequestParams = {},
) =>
  httpRequest<
    DomainPWResponse & {
      data?: GithubComOrionPlatformOrionKnowledgeProApiShareV1WecomCallbackResp;
    }
  >({
    path: `/share/pro/v1/openapi/wecom/callback`,
    method: "GET",
    query: query,
    type: ContentType.Json,
    format: "json",
    ...params,
  });
