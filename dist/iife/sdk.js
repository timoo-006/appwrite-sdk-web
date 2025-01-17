(function (exports) {
    'use strict';

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    class Service {
        constructor(client) {
            this.client = client;
        }
        static flatten(data, prefix = '') {
            let output = {};
            for (const key in data) {
                let value = data[key];
                let finalKey = prefix ? `${prefix}[${key}]` : key;
                if (Array.isArray(value)) {
                    output = Object.assign(output, this.flatten(value, finalKey));
                }
                else {
                    output[finalKey] = value;
                }
            }
            return output;
        }
    }
    Service.CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

    class Query {
    }
    Query.equal = (attribute, value) => Query.addQuery(attribute, "equal", value);
    Query.notEqual = (attribute, value) => Query.addQuery(attribute, "notEqual", value);
    Query.lessThan = (attribute, value) => Query.addQuery(attribute, "lessThan", value);
    Query.lessThanEqual = (attribute, value) => Query.addQuery(attribute, "lessThanEqual", value);
    Query.greaterThan = (attribute, value) => Query.addQuery(attribute, "greaterThan", value);
    Query.greaterThanEqual = (attribute, value) => Query.addQuery(attribute, "greaterThanEqual", value);
    Query.isNull = (attribute) => `isNull("${attribute}")`;
    Query.isNotNull = (attribute) => `isNotNull("${attribute}")`;
    Query.between = (attribute, start, end) => `between("${attribute}", ${Query.parseValues(start)}, ${Query.parseValues(end)})`;
    Query.startsWith = (attribute, value) => Query.addQuery(attribute, "startsWith", value);
    Query.endsWith = (attribute, value) => Query.addQuery(attribute, "endsWith", value);
    Query.select = (attributes) => `select([${attributes.map((attr) => `"${attr}"`).join(",")}])`;
    Query.search = (attribute, value) => Query.addQuery(attribute, "search", value);
    Query.orderDesc = (attribute) => `orderDesc("${attribute}")`;
    Query.orderAsc = (attribute) => `orderAsc("${attribute}")`;
    Query.cursorAfter = (documentId) => `cursorAfter("${documentId}")`;
    Query.cursorBefore = (documentId) => `cursorBefore("${documentId}")`;
    Query.limit = (limit) => `limit(${limit})`;
    Query.offset = (offset) => `offset(${offset})`;
    Query.addQuery = (attribute, method, value) => value instanceof Array
        ? `${method}("${attribute}", [${value
        .map((v) => Query.parseValues(v))
        .join(",")}])`
        : `${method}("${attribute}", [${Query.parseValues(value)}])`;
    Query.parseValues = (value) => typeof value === "string" || value instanceof String
        ? `"${value}"`
        : `${value}`;

    class AppwriteException extends Error {
        constructor(message, code = 0, type = '', response = '') {
            super(message);
            this.name = 'AppwriteException';
            this.message = message;
            this.code = code;
            this.type = type;
            this.response = response;
        }
    }
    class Client {
        constructor() {
            this.config = {
                endpoint: 'https://HOSTNAME/v1',
                endpointRealtime: '',
                project: '',
                jwt: '',
                locale: '',
            };
            this.headers = {
                'x-sdk-name': 'Web',
                'x-sdk-platform': 'client',
                'x-sdk-language': 'web',
                'x-sdk-version': '13.0.1',
                'X-Appwrite-Response-Format': '1.4.0',
            };
            this.realtime = {
                socket: undefined,
                timeout: undefined,
                url: '',
                channels: new Set(),
                subscriptions: new Map(),
                subscriptionsCounter: 0,
                reconnect: true,
                reconnectAttempts: 0,
                lastMessage: undefined,
                connect: () => {
                    clearTimeout(this.realtime.timeout);
                    this.realtime.timeout = window === null || window === void 0 ? void 0 : window.setTimeout(() => {
                        this.realtime.createSocket();
                    }, 50);
                },
                getTimeout: () => {
                    switch (true) {
                        case this.realtime.reconnectAttempts < 5:
                            return 1000;
                        case this.realtime.reconnectAttempts < 15:
                            return 5000;
                        case this.realtime.reconnectAttempts < 100:
                            return 10000;
                        default:
                            return 60000;
                    }
                },
                createSocket: () => {
                    var _a, _b;
                    if (this.realtime.channels.size < 1)
                        return;
                    const channels = new URLSearchParams();
                    channels.set('project', this.config.project);
                    this.realtime.channels.forEach(channel => {
                        channels.append('channels[]', channel);
                    });
                    const url = this.config.endpointRealtime + '/realtime?' + channels.toString();
                    if (url !== this.realtime.url || // Check if URL is present
                        !this.realtime.socket || // Check if WebSocket has not been created
                        ((_a = this.realtime.socket) === null || _a === void 0 ? void 0 : _a.readyState) > WebSocket.OPEN // Check if WebSocket is CLOSING (3) or CLOSED (4)
                    ) {
                        if (this.realtime.socket &&
                            ((_b = this.realtime.socket) === null || _b === void 0 ? void 0 : _b.readyState) < WebSocket.CLOSING // Close WebSocket if it is CONNECTING (0) or OPEN (1)
                        ) {
                            this.realtime.reconnect = false;
                            this.realtime.socket.close();
                        }
                        this.realtime.url = url;
                        this.realtime.socket = new WebSocket(url);
                        this.realtime.socket.addEventListener('message', this.realtime.onMessage);
                        this.realtime.socket.addEventListener('open', _event => {
                            this.realtime.reconnectAttempts = 0;
                        });
                        this.realtime.socket.addEventListener('close', event => {
                            var _a, _b, _c;
                            if (!this.realtime.reconnect ||
                                (((_b = (_a = this.realtime) === null || _a === void 0 ? void 0 : _a.lastMessage) === null || _b === void 0 ? void 0 : _b.type) === 'error' && // Check if last message was of type error
                                    ((_c = this.realtime) === null || _c === void 0 ? void 0 : _c.lastMessage.data).code === 1008 // Check for policy violation 1008
                                )) {
                                this.realtime.reconnect = true;
                                return;
                            }
                            const timeout = this.realtime.getTimeout();
                            console.error(`Realtime got disconnected. Reconnect will be attempted in ${timeout / 1000} seconds.`, event.reason);
                            setTimeout(() => {
                                this.realtime.reconnectAttempts++;
                                this.realtime.createSocket();
                            }, timeout);
                        });
                    }
                },
                onMessage: (event) => {
                    var _a, _b;
                    try {
                        const message = JSON.parse(event.data);
                        this.realtime.lastMessage = message;
                        switch (message.type) {
                            case 'connected':
                                const cookie = JSON.parse((_a = window.localStorage.getItem('cookieFallback')) !== null && _a !== void 0 ? _a : '{}');
                                const session = cookie === null || cookie === void 0 ? void 0 : cookie[`a_session_${this.config.project}`];
                                const messageData = message.data;
                                if (session && !messageData.user) {
                                    (_b = this.realtime.socket) === null || _b === void 0 ? void 0 : _b.send(JSON.stringify({
                                        type: 'authentication',
                                        data: {
                                            session
                                        }
                                    }));
                                }
                                break;
                            case 'event':
                                let data = message.data;
                                if (data === null || data === void 0 ? void 0 : data.channels) {
                                    const isSubscribed = data.channels.some(channel => this.realtime.channels.has(channel));
                                    if (!isSubscribed)
                                        return;
                                    this.realtime.subscriptions.forEach(subscription => {
                                        if (data.channels.some(channel => subscription.channels.includes(channel))) {
                                            setTimeout(() => subscription.callback(data));
                                        }
                                    });
                                }
                                break;
                            case 'error':
                                throw message.data;
                            default:
                                break;
                        }
                    }
                    catch (e) {
                        console.error(e);
                    }
                },
                cleanUp: channels => {
                    this.realtime.channels.forEach(channel => {
                        if (channels.includes(channel)) {
                            let found = Array.from(this.realtime.subscriptions).some(([_key, subscription]) => {
                                return subscription.channels.includes(channel);
                            });
                            if (!found) {
                                this.realtime.channels.delete(channel);
                            }
                        }
                    });
                }
            };
        }
        /**
         * Set Endpoint
         *
         * Your project endpoint
         *
         * @param {string} endpoint
         *
         * @returns {this}
         */
        setEndpoint(endpoint) {
            this.config.endpoint = endpoint;
            this.config.endpointRealtime = this.config.endpointRealtime || this.config.endpoint.replace('https://', 'wss://').replace('http://', 'ws://');
            return this;
        }
        /**
         * Set Realtime Endpoint
         *
         * @param {string} endpointRealtime
         *
         * @returns {this}
         */
        setEndpointRealtime(endpointRealtime) {
            this.config.endpointRealtime = endpointRealtime;
            return this;
        }
        /**
         * Set Project
         *
         * Your project ID
         *
         * @param value string
         *
         * @return {this}
         */
        setProject(value) {
            this.headers['X-Appwrite-Project'] = value;
            this.config.project = value;
            return this;
        }
        /**
         * Set JWT
         *
         * Your secret JSON Web Token
         *
         * @param value string
         *
         * @return {this}
         */
        setJWT(value) {
            this.headers['X-Appwrite-JWT'] = value;
            this.config.jwt = value;
            return this;
        }
        /**
         * Set Locale
         *
         * @param value string
         *
         * @return {this}
         */
        setLocale(value) {
            this.headers['X-Appwrite-Locale'] = value;
            this.config.locale = value;
            return this;
        }
        /**
         * Subscribes to Appwrite events and passes you the payload in realtime.
         *
         * @param {string|string[]} channels
         * Channel to subscribe - pass a single channel as a string or multiple with an array of strings.
         *
         * Possible channels are:
         * - account
         * - collections
         * - collections.[ID]
         * - collections.[ID].documents
         * - documents
         * - documents.[ID]
         * - files
         * - files.[ID]
         * - executions
         * - executions.[ID]
         * - functions.[ID]
         * - teams
         * - teams.[ID]
         * - memberships
         * - memberships.[ID]
         * @param {(payload: RealtimeMessage) => void} callback Is called on every realtime update.
         * @returns {() => void} Unsubscribes from events.
         */
        subscribe(channels, callback) {
            let channelArray = typeof channels === 'string' ? [channels] : channels;
            channelArray.forEach(channel => this.realtime.channels.add(channel));
            const counter = this.realtime.subscriptionsCounter++;
            this.realtime.subscriptions.set(counter, {
                channels: channelArray,
                callback
            });
            this.realtime.connect();
            return () => {
                this.realtime.subscriptions.delete(counter);
                this.realtime.cleanUp(channelArray);
                this.realtime.connect();
            };
        }
        call(method, url, headers = {}, params = {}) {
            var _a, _b;
            return __awaiter(this, void 0, void 0, function* () {
                method = method.toUpperCase();
                headers = Object.assign({}, this.headers, headers);
                let options = {
                    method,
                    headers,
                    credentials: 'include'
                };
                if (typeof window !== 'undefined' && window.localStorage) {
                    headers['X-Fallback-Cookies'] = (_a = window.localStorage.getItem('cookieFallback')) !== null && _a !== void 0 ? _a : '';
                }
                if (method === 'GET') {
                    for (const [key, value] of Object.entries(Service.flatten(params))) {
                        url.searchParams.append(key, value);
                    }
                }
                else {
                    switch (headers['content-type']) {
                        case 'application/json':
                            options.body = JSON.stringify(params);
                            break;
                        case 'multipart/form-data':
                            let formData = new FormData();
                            for (const key in params) {
                                if (Array.isArray(params[key])) {
                                    params[key].forEach((value) => {
                                        formData.append(key + '[]', value);
                                    });
                                }
                                else {
                                    formData.append(key, params[key]);
                                }
                            }
                            options.body = formData;
                            delete headers['content-type'];
                            break;
                    }
                }
                try {
                    let data = null;
                    const response = yield fetch(url.toString(), options);
                    if ((_b = response.headers.get('content-type')) === null || _b === void 0 ? void 0 : _b.includes('application/json')) {
                        data = yield response.json();
                    }
                    else {
                        data = {
                            message: yield response.text()
                        };
                    }
                    if (400 <= response.status) {
                        throw new AppwriteException(data === null || data === void 0 ? void 0 : data.message, response.status, data === null || data === void 0 ? void 0 : data.type, data);
                    }
                    const cookieFallback = response.headers.get('X-Fallback-Cookies');
                    if (typeof window !== 'undefined' && window.localStorage && cookieFallback) {
                        window.console.warn('Appwrite is using localStorage for session management. Increase your security by adding a custom domain as your API endpoint.');
                        window.localStorage.setItem('cookieFallback', cookieFallback);
                    }
                    return data;
                }
                catch (e) {
                    if (e instanceof AppwriteException) {
                        throw e;
                    }
                    throw new AppwriteException(e.message);
                }
            });
        }
    }

    class Account extends Service {
        constructor(client) {
            super(client);
        }
        /**
         * Get account
         *
         * Get the currently logged in user.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        get() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/account';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create account
         *
         * Use this endpoint to allow a new user to register a new account in your
         * project. After the user registration completes successfully, you can use
         * the
         * [/account/verfication](https://appwrite.io/docs/references/cloud/client-web/account#createVerification)
         * route to start verifying the user email address. To allow the new user to
         * login to their new account, you need to create a new [account
         * session](https://appwrite.io/docs/references/cloud/client-web/account#createEmailSession).
         *
         * @param {string} userId
         * @param {string} email
         * @param {string} password
         * @param {string} name
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        create(userId, email, password, name) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof userId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "userId"');
                }
                if (typeof email === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "email"');
                }
                if (typeof password === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "password"');
                }
                const apiPath = '/account';
                const payload = {};
                if (typeof userId !== 'undefined') {
                    payload['userId'] = userId;
                }
                if (typeof email !== 'undefined') {
                    payload['email'] = email;
                }
                if (typeof password !== 'undefined') {
                    payload['password'] = password;
                }
                if (typeof name !== 'undefined') {
                    payload['name'] = name;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update email
         *
         * Update currently logged in user account email address. After changing user
         * address, the user confirmation status will get reset. A new confirmation
         * email is not sent automatically however you can use the send confirmation
         * email endpoint again to send the confirmation email. For security measures,
         * user password is required to complete this request.
         * This endpoint can also be used to convert an anonymous account to a normal
         * one, by passing an email address and a new password.
         *
         *
         * @param {string} email
         * @param {string} password
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateEmail(email, password) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof email === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "email"');
                }
                if (typeof password === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "password"');
                }
                const apiPath = '/account/email';
                const payload = {};
                if (typeof email !== 'undefined') {
                    payload['email'] = email;
                }
                if (typeof password !== 'undefined') {
                    payload['password'] = password;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('patch', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List Identities
         *
         * Get the list of identities for the currently logged in user.
         *
         * @param {string} queries
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listIdentities(queries) {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/account/identities';
                const payload = {};
                if (typeof queries !== 'undefined') {
                    payload['queries'] = queries;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Delete Identity
         *
         * Delete an identity by its unique ID.
         *
         * @param {string} identityId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        deleteIdentity(identityId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof identityId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "identityId"');
                }
                const apiPath = '/account/identities/{identityId}'.replace('{identityId}', identityId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('delete', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create JWT
         *
         * Use this endpoint to create a JSON Web Token. You can use the resulting JWT
         * to authenticate on behalf of the current user when working with the
         * Appwrite server-side API and SDKs. The JWT secret is valid for 15 minutes
         * from its creation and will be invalid if the user will logout in that time
         * frame.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createJWT() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/account/jwt';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List logs
         *
         * Get the list of latest security activity logs for the currently logged in
         * user. Each log returns user IP address, location and date and time of log.
         *
         * @param {string[]} queries
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listLogs(queries) {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/account/logs';
                const payload = {};
                if (typeof queries !== 'undefined') {
                    payload['queries'] = queries;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update name
         *
         * Update currently logged in user account name.
         *
         * @param {string} name
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateName(name) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof name === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "name"');
                }
                const apiPath = '/account/name';
                const payload = {};
                if (typeof name !== 'undefined') {
                    payload['name'] = name;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('patch', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update password
         *
         * Update currently logged in user password. For validation, user is required
         * to pass in the new password, and the old password. For users created with
         * OAuth, Team Invites and Magic URL, oldPassword is optional.
         *
         * @param {string} password
         * @param {string} oldPassword
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updatePassword(password, oldPassword) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof password === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "password"');
                }
                const apiPath = '/account/password';
                const payload = {};
                if (typeof password !== 'undefined') {
                    payload['password'] = password;
                }
                if (typeof oldPassword !== 'undefined') {
                    payload['oldPassword'] = oldPassword;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('patch', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update phone
         *
         * Update the currently logged in user's phone number. After updating the
         * phone number, the phone verification status will be reset. A confirmation
         * SMS is not sent automatically, however you can use the [POST
         * /account/verification/phone](https://appwrite.io/docs/references/cloud/client-web/account#createPhoneVerification)
         * endpoint to send a confirmation SMS.
         *
         * @param {string} phone
         * @param {string} password
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updatePhone(phone, password) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof phone === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "phone"');
                }
                if (typeof password === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "password"');
                }
                const apiPath = '/account/phone';
                const payload = {};
                if (typeof phone !== 'undefined') {
                    payload['phone'] = phone;
                }
                if (typeof password !== 'undefined') {
                    payload['password'] = password;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('patch', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Get account preferences
         *
         * Get the preferences as a key-value object for the currently logged in user.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        getPrefs() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/account/prefs';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update preferences
         *
         * Update currently logged in user account preferences. The object you pass is
         * stored as is, and replaces any previous value. The maximum allowed prefs
         * size is 64kB and throws error if exceeded.
         *
         * @param {Partial<Preferences>} prefs
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updatePrefs(prefs) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof prefs === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "prefs"');
                }
                const apiPath = '/account/prefs';
                const payload = {};
                if (typeof prefs !== 'undefined') {
                    payload['prefs'] = prefs;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('patch', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create password recovery
         *
         * Sends the user an email with a temporary secret key for password reset.
         * When the user clicks the confirmation link he is redirected back to your
         * app password reset URL with the secret key and email address values
         * attached to the URL query string. Use the query string params to submit a
         * request to the [PUT
         * /account/recovery](https://appwrite.io/docs/references/cloud/client-web/account#updateRecovery)
         * endpoint to complete the process. The verification link sent to the user's
         * email address is valid for 1 hour.
         *
         * @param {string} email
         * @param {string} url
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createRecovery(email, url) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof email === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "email"');
                }
                if (typeof url === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "url"');
                }
                const apiPath = '/account/recovery';
                const payload = {};
                if (typeof email !== 'undefined') {
                    payload['email'] = email;
                }
                if (typeof url !== 'undefined') {
                    payload['url'] = url;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create password recovery (confirmation)
         *
         * Use this endpoint to complete the user account password reset. Both the
         * **userId** and **secret** arguments will be passed as query parameters to
         * the redirect URL you have provided when sending your request to the [POST
         * /account/recovery](https://appwrite.io/docs/references/cloud/client-web/account#createRecovery)
         * endpoint.
         *
         * Please note that in order to avoid a [Redirect
         * Attack](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.md)
         * the only valid redirect URLs are the ones from domains you have set when
         * adding your platforms in the console interface.
         *
         * @param {string} userId
         * @param {string} secret
         * @param {string} password
         * @param {string} passwordAgain
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateRecovery(userId, secret, password, passwordAgain) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof userId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "userId"');
                }
                if (typeof secret === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "secret"');
                }
                if (typeof password === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "password"');
                }
                if (typeof passwordAgain === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "passwordAgain"');
                }
                const apiPath = '/account/recovery';
                const payload = {};
                if (typeof userId !== 'undefined') {
                    payload['userId'] = userId;
                }
                if (typeof secret !== 'undefined') {
                    payload['secret'] = secret;
                }
                if (typeof password !== 'undefined') {
                    payload['password'] = password;
                }
                if (typeof passwordAgain !== 'undefined') {
                    payload['passwordAgain'] = passwordAgain;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('put', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List sessions
         *
         * Get the list of active sessions across different devices for the currently
         * logged in user.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listSessions() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/account/sessions';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Delete sessions
         *
         * Delete all sessions from the user account and remove any sessions cookies
         * from the end client.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        deleteSessions() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/account/sessions';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('delete', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create anonymous session
         *
         * Use this endpoint to allow a new user to register an anonymous account in
         * your project. This route will also create a new session for the user. To
         * allow the new user to convert an anonymous account to a normal account, you
         * need to update its [email and
         * password](https://appwrite.io/docs/references/cloud/client-web/account#updateEmail)
         * or create an [OAuth2
         * session](https://appwrite.io/docs/references/cloud/client-web/account#CreateOAuth2Session).
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createAnonymousSession() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/account/sessions/anonymous';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create email session
         *
         * Allow the user to login into their account by providing a valid email and
         * password combination. This route will create a new session for the user.
         *
         * A user is limited to 10 active sessions at a time by default. [Learn more
         * about session
         * limits](https://appwrite.io/docs/authentication-security#limits).
         *
         * @param {string} email
         * @param {string} password
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createEmailSession(email, password) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof email === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "email"');
                }
                if (typeof password === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "password"');
                }
                const apiPath = '/account/sessions/email';
                const payload = {};
                if (typeof email !== 'undefined') {
                    payload['email'] = email;
                }
                if (typeof password !== 'undefined') {
                    payload['password'] = password;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create magic URL session
         *
         * Sends the user an email with a secret key for creating a session. If the
         * provided user ID has not been registered, a new user will be created. When
         * the user clicks the link in the email, the user is redirected back to the
         * URL you provided with the secret key and userId values attached to the URL
         * query string. Use the query string parameters to submit a request to the
         * [PUT
         * /account/sessions/magic-url](https://appwrite.io/docs/references/cloud/client-web/account#updateMagicURLSession)
         * endpoint to complete the login process. The link sent to the user's email
         * address is valid for 1 hour. If you are on a mobile device you can leave
         * the URL parameter empty, so that the login completion will be handled by
         * your Appwrite instance by default.
         *
         * A user is limited to 10 active sessions at a time by default. [Learn more
         * about session
         * limits](https://appwrite.io/docs/authentication-security#limits).
         *
         *
         * @param {string} userId
         * @param {string} email
         * @param {string} url
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createMagicURLSession(userId, email, url) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof userId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "userId"');
                }
                if (typeof email === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "email"');
                }
                const apiPath = '/account/sessions/magic-url';
                const payload = {};
                if (typeof userId !== 'undefined') {
                    payload['userId'] = userId;
                }
                if (typeof email !== 'undefined') {
                    payload['email'] = email;
                }
                if (typeof url !== 'undefined') {
                    payload['url'] = url;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create magic URL session (confirmation)
         *
         * Use this endpoint to complete creating the session with the Magic URL. Both
         * the **userId** and **secret** arguments will be passed as query parameters
         * to the redirect URL you have provided when sending your request to the
         * [POST
         * /account/sessions/magic-url](https://appwrite.io/docs/references/cloud/client-web/account#createMagicURLSession)
         * endpoint.
         *
         * Please note that in order to avoid a [Redirect
         * Attack](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.md)
         * the only valid redirect URLs are the ones from domains you have set when
         * adding your platforms in the console interface.
         *
         * @param {string} userId
         * @param {string} secret
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateMagicURLSession(userId, secret) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof userId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "userId"');
                }
                if (typeof secret === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "secret"');
                }
                const apiPath = '/account/sessions/magic-url';
                const payload = {};
                if (typeof userId !== 'undefined') {
                    payload['userId'] = userId;
                }
                if (typeof secret !== 'undefined') {
                    payload['secret'] = secret;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('put', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create OAuth2 session
         *
         * Allow the user to login to their account using the OAuth2 provider of their
         * choice. Each OAuth2 provider should be enabled from the Appwrite console
         * first. Use the success and failure arguments to provide a redirect URL's
         * back to your app when login is completed.
         *
         * If there is already an active session, the new session will be attached to
         * the logged-in account. If there are no active sessions, the server will
         * attempt to look for a user with the same email address as the email
         * received from the OAuth2 provider and attach the new session to the
         * existing user. If no matching user is found - the server will create a new
         * user.
         *
         * A user is limited to 10 active sessions at a time by default. [Learn more
         * about session
         * limits](https://appwrite.io/docs/authentication-security#limits).
         *
         *
         * @param {string} provider
         * @param {string} success
         * @param {string} failure
         * @param {string[]} scopes
         * @throws {AppwriteException}
         * @returns {void|string}
        */
        createOAuth2Session(provider, success, failure, scopes) {
            if (typeof provider === 'undefined') {
                throw new AppwriteException('Missing required parameter: "provider"');
            }
            const apiPath = '/account/sessions/oauth2/{provider}'.replace('{provider}', provider);
            const payload = {};
            if (typeof success !== 'undefined') {
                payload['success'] = success;
            }
            if (typeof failure !== 'undefined') {
                payload['failure'] = failure;
            }
            if (typeof scopes !== 'undefined') {
                payload['scopes'] = scopes;
            }
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            if (typeof window !== 'undefined' && (window === null || window === void 0 ? void 0 : window.location)) {
                window.location.href = uri.toString();
            }
            else {
                return uri;
            }
        }
        /**
         * Create phone session
         *
         * Sends the user an SMS with a secret key for creating a session. If the
         * provided user ID has not be registered, a new user will be created. Use the
         * returned user ID and secret and submit a request to the [PUT
         * /account/sessions/phone](https://appwrite.io/docs/references/cloud/client-web/account#updatePhoneSession)
         * endpoint to complete the login process. The secret sent to the user's phone
         * is valid for 15 minutes.
         *
         * A user is limited to 10 active sessions at a time by default. [Learn more
         * about session
         * limits](https://appwrite.io/docs/authentication-security#limits).
         *
         * @param {string} userId
         * @param {string} phone
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createPhoneSession(userId, phone) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof userId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "userId"');
                }
                if (typeof phone === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "phone"');
                }
                const apiPath = '/account/sessions/phone';
                const payload = {};
                if (typeof userId !== 'undefined') {
                    payload['userId'] = userId;
                }
                if (typeof phone !== 'undefined') {
                    payload['phone'] = phone;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create phone session (confirmation)
         *
         * Use this endpoint to complete creating a session with SMS. Use the
         * **userId** from the
         * [createPhoneSession](https://appwrite.io/docs/references/cloud/client-web/account#createPhoneSession)
         * endpoint and the **secret** received via SMS to successfully update and
         * confirm the phone session.
         *
         * @param {string} userId
         * @param {string} secret
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updatePhoneSession(userId, secret) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof userId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "userId"');
                }
                if (typeof secret === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "secret"');
                }
                const apiPath = '/account/sessions/phone';
                const payload = {};
                if (typeof userId !== 'undefined') {
                    payload['userId'] = userId;
                }
                if (typeof secret !== 'undefined') {
                    payload['secret'] = secret;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('put', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Get session
         *
         * Use this endpoint to get a logged in user's session using a Session ID.
         * Inputting 'current' will return the current session being used.
         *
         * @param {string} sessionId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        getSession(sessionId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof sessionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "sessionId"');
                }
                const apiPath = '/account/sessions/{sessionId}'.replace('{sessionId}', sessionId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update OAuth session (refresh tokens)
         *
         * Access tokens have limited lifespan and expire to mitigate security risks.
         * If session was created using an OAuth provider, this route can be used to
         * "refresh" the access token.
         *
         * @param {string} sessionId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateSession(sessionId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof sessionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "sessionId"');
                }
                const apiPath = '/account/sessions/{sessionId}'.replace('{sessionId}', sessionId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('patch', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Delete session
         *
         * Logout the user. Use 'current' as the session ID to logout on this device,
         * use a session ID to logout on another device. If you're looking to logout
         * the user on all devices, use [Delete
         * Sessions](https://appwrite.io/docs/references/cloud/client-web/account#deleteSessions)
         * instead.
         *
         * @param {string} sessionId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        deleteSession(sessionId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof sessionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "sessionId"');
                }
                const apiPath = '/account/sessions/{sessionId}'.replace('{sessionId}', sessionId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('delete', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update status
         *
         * Block the currently logged in user account. Behind the scene, the user
         * record is not deleted but permanently blocked from any access. To
         * completely delete a user, use the Users API instead.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateStatus() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/account/status';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('patch', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create email verification
         *
         * Use this endpoint to send a verification message to your user email address
         * to confirm they are the valid owners of that address. Both the **userId**
         * and **secret** arguments will be passed as query parameters to the URL you
         * have provided to be attached to the verification email. The provided URL
         * should redirect the user back to your app and allow you to complete the
         * verification process by verifying both the **userId** and **secret**
         * parameters. Learn more about how to [complete the verification
         * process](https://appwrite.io/docs/references/cloud/client-web/account#updateVerification).
         * The verification link sent to the user's email address is valid for 7 days.
         *
         * Please note that in order to avoid a [Redirect
         * Attack](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.md),
         * the only valid redirect URLs are the ones from domains you have set when
         * adding your platforms in the console interface.
         *
         *
         * @param {string} url
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createVerification(url) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof url === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "url"');
                }
                const apiPath = '/account/verification';
                const payload = {};
                if (typeof url !== 'undefined') {
                    payload['url'] = url;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create email verification (confirmation)
         *
         * Use this endpoint to complete the user email verification process. Use both
         * the **userId** and **secret** parameters that were attached to your app URL
         * to verify the user email ownership. If confirmed this route will return a
         * 200 status code.
         *
         * @param {string} userId
         * @param {string} secret
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateVerification(userId, secret) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof userId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "userId"');
                }
                if (typeof secret === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "secret"');
                }
                const apiPath = '/account/verification';
                const payload = {};
                if (typeof userId !== 'undefined') {
                    payload['userId'] = userId;
                }
                if (typeof secret !== 'undefined') {
                    payload['secret'] = secret;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('put', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create phone verification
         *
         * Use this endpoint to send a verification SMS to the currently logged in
         * user. This endpoint is meant for use after updating a user's phone number
         * using the
         * [accountUpdatePhone](https://appwrite.io/docs/references/cloud/client-web/account#updatePhone)
         * endpoint. Learn more about how to [complete the verification
         * process](https://appwrite.io/docs/references/cloud/client-web/account#updatePhoneVerification).
         * The verification code sent to the user's phone number is valid for 15
         * minutes.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createPhoneVerification() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/account/verification/phone';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create phone verification (confirmation)
         *
         * Use this endpoint to complete the user phone verification process. Use the
         * **userId** and **secret** that were sent to your user's phone number to
         * verify the user email ownership. If confirmed this route will return a 200
         * status code.
         *
         * @param {string} userId
         * @param {string} secret
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updatePhoneVerification(userId, secret) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof userId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "userId"');
                }
                if (typeof secret === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "secret"');
                }
                const apiPath = '/account/verification/phone';
                const payload = {};
                if (typeof userId !== 'undefined') {
                    payload['userId'] = userId;
                }
                if (typeof secret !== 'undefined') {
                    payload['secret'] = secret;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('put', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
    }

    class Avatars extends Service {
        constructor(client) {
            super(client);
        }
        /**
         * Get browser icon
         *
         * You can use this endpoint to show different browser icons to your users.
         * The code argument receives the browser code as it appears in your user [GET
         * /account/sessions](https://appwrite.io/docs/references/cloud/client-web/account#getSessions)
         * endpoint. Use width, height and quality arguments to change the output
         * settings.
         *
         * When one dimension is specified and the other is 0, the image is scaled
         * with preserved aspect ratio. If both dimensions are 0, the API provides an
         * image at source quality. If dimensions are not specified, the default size
         * of image returned is 100x100px.
         *
         * @param {string} code
         * @param {number} width
         * @param {number} height
         * @param {number} quality
         * @throws {AppwriteException}
         * @returns {URL}
        */
        getBrowser(code, width, height, quality) {
            if (typeof code === 'undefined') {
                throw new AppwriteException('Missing required parameter: "code"');
            }
            const apiPath = '/avatars/browsers/{code}'.replace('{code}', code);
            const payload = {};
            if (typeof width !== 'undefined') {
                payload['width'] = width;
            }
            if (typeof height !== 'undefined') {
                payload['height'] = height;
            }
            if (typeof quality !== 'undefined') {
                payload['quality'] = quality;
            }
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            return uri;
        }
        /**
         * Get credit card icon
         *
         * The credit card endpoint will return you the icon of the credit card
         * provider you need. Use width, height and quality arguments to change the
         * output settings.
         *
         * When one dimension is specified and the other is 0, the image is scaled
         * with preserved aspect ratio. If both dimensions are 0, the API provides an
         * image at source quality. If dimensions are not specified, the default size
         * of image returned is 100x100px.
         *
         *
         * @param {string} code
         * @param {number} width
         * @param {number} height
         * @param {number} quality
         * @throws {AppwriteException}
         * @returns {URL}
        */
        getCreditCard(code, width, height, quality) {
            if (typeof code === 'undefined') {
                throw new AppwriteException('Missing required parameter: "code"');
            }
            const apiPath = '/avatars/credit-cards/{code}'.replace('{code}', code);
            const payload = {};
            if (typeof width !== 'undefined') {
                payload['width'] = width;
            }
            if (typeof height !== 'undefined') {
                payload['height'] = height;
            }
            if (typeof quality !== 'undefined') {
                payload['quality'] = quality;
            }
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            return uri;
        }
        /**
         * Get favicon
         *
         * Use this endpoint to fetch the favorite icon (AKA favicon) of any remote
         * website URL.
         *
         *
         * @param {string} url
         * @throws {AppwriteException}
         * @returns {URL}
        */
        getFavicon(url) {
            if (typeof url === 'undefined') {
                throw new AppwriteException('Missing required parameter: "url"');
            }
            const apiPath = '/avatars/favicon';
            const payload = {};
            if (typeof url !== 'undefined') {
                payload['url'] = url;
            }
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            return uri;
        }
        /**
         * Get country flag
         *
         * You can use this endpoint to show different country flags icons to your
         * users. The code argument receives the 2 letter country code. Use width,
         * height and quality arguments to change the output settings. Country codes
         * follow the [ISO 3166-1](https://en.wikipedia.org/wiki/ISO_3166-1) standard.
         *
         * When one dimension is specified and the other is 0, the image is scaled
         * with preserved aspect ratio. If both dimensions are 0, the API provides an
         * image at source quality. If dimensions are not specified, the default size
         * of image returned is 100x100px.
         *
         *
         * @param {string} code
         * @param {number} width
         * @param {number} height
         * @param {number} quality
         * @throws {AppwriteException}
         * @returns {URL}
        */
        getFlag(code, width, height, quality) {
            if (typeof code === 'undefined') {
                throw new AppwriteException('Missing required parameter: "code"');
            }
            const apiPath = '/avatars/flags/{code}'.replace('{code}', code);
            const payload = {};
            if (typeof width !== 'undefined') {
                payload['width'] = width;
            }
            if (typeof height !== 'undefined') {
                payload['height'] = height;
            }
            if (typeof quality !== 'undefined') {
                payload['quality'] = quality;
            }
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            return uri;
        }
        /**
         * Get image from URL
         *
         * Use this endpoint to fetch a remote image URL and crop it to any image size
         * you want. This endpoint is very useful if you need to crop and display
         * remote images in your app or in case you want to make sure a 3rd party
         * image is properly served using a TLS protocol.
         *
         * When one dimension is specified and the other is 0, the image is scaled
         * with preserved aspect ratio. If both dimensions are 0, the API provides an
         * image at source quality. If dimensions are not specified, the default size
         * of image returned is 400x400px.
         *
         *
         * @param {string} url
         * @param {number} width
         * @param {number} height
         * @throws {AppwriteException}
         * @returns {URL}
        */
        getImage(url, width, height) {
            if (typeof url === 'undefined') {
                throw new AppwriteException('Missing required parameter: "url"');
            }
            const apiPath = '/avatars/image';
            const payload = {};
            if (typeof url !== 'undefined') {
                payload['url'] = url;
            }
            if (typeof width !== 'undefined') {
                payload['width'] = width;
            }
            if (typeof height !== 'undefined') {
                payload['height'] = height;
            }
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            return uri;
        }
        /**
         * Get user initials
         *
         * Use this endpoint to show your user initials avatar icon on your website or
         * app. By default, this route will try to print your logged-in user name or
         * email initials. You can also overwrite the user name if you pass the 'name'
         * parameter. If no name is given and no user is logged, an empty avatar will
         * be returned.
         *
         * You can use the color and background params to change the avatar colors. By
         * default, a random theme will be selected. The random theme will persist for
         * the user's initials when reloading the same theme will always return for
         * the same initials.
         *
         * When one dimension is specified and the other is 0, the image is scaled
         * with preserved aspect ratio. If both dimensions are 0, the API provides an
         * image at source quality. If dimensions are not specified, the default size
         * of image returned is 100x100px.
         *
         *
         * @param {string} name
         * @param {number} width
         * @param {number} height
         * @param {string} background
         * @throws {AppwriteException}
         * @returns {URL}
        */
        getInitials(name, width, height, background) {
            const apiPath = '/avatars/initials';
            const payload = {};
            if (typeof name !== 'undefined') {
                payload['name'] = name;
            }
            if (typeof width !== 'undefined') {
                payload['width'] = width;
            }
            if (typeof height !== 'undefined') {
                payload['height'] = height;
            }
            if (typeof background !== 'undefined') {
                payload['background'] = background;
            }
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            return uri;
        }
        /**
         * Get QR code
         *
         * Converts a given plain text to a QR code image. You can use the query
         * parameters to change the size and style of the resulting image.
         *
         *
         * @param {string} text
         * @param {number} size
         * @param {number} margin
         * @param {boolean} download
         * @throws {AppwriteException}
         * @returns {URL}
        */
        getQR(text, size, margin, download) {
            if (typeof text === 'undefined') {
                throw new AppwriteException('Missing required parameter: "text"');
            }
            const apiPath = '/avatars/qr';
            const payload = {};
            if (typeof text !== 'undefined') {
                payload['text'] = text;
            }
            if (typeof size !== 'undefined') {
                payload['size'] = size;
            }
            if (typeof margin !== 'undefined') {
                payload['margin'] = margin;
            }
            if (typeof download !== 'undefined') {
                payload['download'] = download;
            }
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            return uri;
        }
    }

    class Databases extends Service {
        constructor(client) {
            super(client);
        }
        /**
         * List documents
         *
         * Get a list of all the user's documents in a given collection. You can use
         * the query params to filter your results.
         *
         * @param {string} databaseId
         * @param {string} collectionId
         * @param {string[]} queries
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listDocuments(databaseId, collectionId, queries) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof databaseId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "databaseId"');
                }
                if (typeof collectionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "collectionId"');
                }
                const apiPath = '/databases/{databaseId}/collections/{collectionId}/documents'.replace('{databaseId}', databaseId).replace('{collectionId}', collectionId);
                const payload = {};
                if (typeof queries !== 'undefined') {
                    payload['queries'] = queries;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create document
         *
         * Create a new Document. Before using this route, you should create a new
         * collection resource using either a [server
         * integration](https://appwrite.io/docs/server/databases#databasesCreateCollection)
         * API or directly from your database console.
         *
         * @param {string} databaseId
         * @param {string} collectionId
         * @param {string} documentId
         * @param {Omit<Document, keyof Models.Document>} data
         * @param {string[]} permissions
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createDocument(databaseId, collectionId, documentId, data, permissions) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof databaseId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "databaseId"');
                }
                if (typeof collectionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "collectionId"');
                }
                if (typeof documentId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "documentId"');
                }
                if (typeof data === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "data"');
                }
                const apiPath = '/databases/{databaseId}/collections/{collectionId}/documents'.replace('{databaseId}', databaseId).replace('{collectionId}', collectionId);
                const payload = {};
                if (typeof documentId !== 'undefined') {
                    payload['documentId'] = documentId;
                }
                if (typeof data !== 'undefined') {
                    payload['data'] = data;
                }
                if (typeof permissions !== 'undefined') {
                    payload['permissions'] = permissions;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Get document
         *
         * Get a document by its unique ID. This endpoint response returns a JSON
         * object with the document data.
         *
         * @param {string} databaseId
         * @param {string} collectionId
         * @param {string} documentId
         * @param {string[]} queries
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        getDocument(databaseId, collectionId, documentId, queries) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof databaseId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "databaseId"');
                }
                if (typeof collectionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "collectionId"');
                }
                if (typeof documentId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "documentId"');
                }
                const apiPath = '/databases/{databaseId}/collections/{collectionId}/documents/{documentId}'.replace('{databaseId}', databaseId).replace('{collectionId}', collectionId).replace('{documentId}', documentId);
                const payload = {};
                if (typeof queries !== 'undefined') {
                    payload['queries'] = queries;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update document
         *
         * Update a document by its unique ID. Using the patch method you can pass
         * only specific fields that will get updated.
         *
         * @param {string} databaseId
         * @param {string} collectionId
         * @param {string} documentId
         * @param {Partial<Omit<Document, keyof Models.Document>>} data
         * @param {string[]} permissions
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateDocument(databaseId, collectionId, documentId, data, permissions) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof databaseId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "databaseId"');
                }
                if (typeof collectionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "collectionId"');
                }
                if (typeof documentId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "documentId"');
                }
                const apiPath = '/databases/{databaseId}/collections/{collectionId}/documents/{documentId}'.replace('{databaseId}', databaseId).replace('{collectionId}', collectionId).replace('{documentId}', documentId);
                const payload = {};
                if (typeof data !== 'undefined') {
                    payload['data'] = data;
                }
                if (typeof permissions !== 'undefined') {
                    payload['permissions'] = permissions;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('patch', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Delete document
         *
         * Delete a document by its unique ID.
         *
         * @param {string} databaseId
         * @param {string} collectionId
         * @param {string} documentId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        deleteDocument(databaseId, collectionId, documentId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof databaseId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "databaseId"');
                }
                if (typeof collectionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "collectionId"');
                }
                if (typeof documentId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "documentId"');
                }
                const apiPath = '/databases/{databaseId}/collections/{collectionId}/documents/{documentId}'.replace('{databaseId}', databaseId).replace('{collectionId}', collectionId).replace('{documentId}', documentId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('delete', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
    }

    class Functions extends Service {
        constructor(client) {
            super(client);
        }
        /**
         * List executions
         *
         * Get a list of all the current user function execution logs. You can use the
         * query params to filter your results.
         *
         * @param {string} functionId
         * @param {string[]} queries
         * @param {string} search
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listExecutions(functionId, queries, search) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof functionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "functionId"');
                }
                const apiPath = '/functions/{functionId}/executions'.replace('{functionId}', functionId);
                const payload = {};
                if (typeof queries !== 'undefined') {
                    payload['queries'] = queries;
                }
                if (typeof search !== 'undefined') {
                    payload['search'] = search;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create execution
         *
         * Trigger a function execution. The returned object will return you the
         * current execution status. You can ping the `Get Execution` endpoint to get
         * updates on the current execution status. Once this endpoint is called, your
         * function execution process will start asynchronously.
         *
         * @param {string} functionId
         * @param {string} body
         * @param {boolean} async
         * @param {string} xpath
         * @param {string} method
         * @param {object} headers
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createExecution(functionId, body, async, xpath, method, headers) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof functionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "functionId"');
                }
                const apiPath = '/functions/{functionId}/executions'.replace('{functionId}', functionId);
                const payload = {};
                if (typeof body !== 'undefined') {
                    payload['body'] = body;
                }
                if (typeof async !== 'undefined') {
                    payload['async'] = async;
                }
                if (typeof xpath !== 'undefined') {
                    payload['path'] = xpath;
                }
                if (typeof method !== 'undefined') {
                    payload['method'] = method;
                }
                if (typeof headers !== 'undefined') {
                    payload['headers'] = headers;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Get execution
         *
         * Get a function execution log by its unique ID.
         *
         * @param {string} functionId
         * @param {string} executionId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        getExecution(functionId, executionId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof functionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "functionId"');
                }
                if (typeof executionId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "executionId"');
                }
                const apiPath = '/functions/{functionId}/executions/{executionId}'.replace('{functionId}', functionId).replace('{executionId}', executionId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
    }

    class Graphql extends Service {
        constructor(client) {
            super(client);
        }
        /**
         * GraphQL endpoint
         *
         * Execute a GraphQL mutation.
         *
         * @param {object} query
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        query(query) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof query === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "query"');
                }
                const apiPath = '/graphql';
                const payload = {};
                if (typeof query !== 'undefined') {
                    payload['query'] = query;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'x-sdk-graphql': 'true',
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * GraphQL endpoint
         *
         * Execute a GraphQL mutation.
         *
         * @param {object} query
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        mutation(query) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof query === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "query"');
                }
                const apiPath = '/graphql/mutation';
                const payload = {};
                if (typeof query !== 'undefined') {
                    payload['query'] = query;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'x-sdk-graphql': 'true',
                    'content-type': 'application/json',
                }, payload);
            });
        }
    }

    class Locale extends Service {
        constructor(client) {
            super(client);
        }
        /**
         * Get user locale
         *
         * Get the current user location based on IP. Returns an object with user
         * country code, country name, continent name, continent code, ip address and
         * suggested currency. You can use the locale header to get the data in a
         * supported language.
         *
         * ([IP Geolocation by DB-IP](https://db-ip.com))
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        get() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/locale';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List Locale Codes
         *
         * List of all locale codes in [ISO
         * 639-1](https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes).
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listCodes() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/locale/codes';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List continents
         *
         * List of all continents. You can use the locale header to get the data in a
         * supported language.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listContinents() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/locale/continents';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List countries
         *
         * List of all countries. You can use the locale header to get the data in a
         * supported language.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listCountries() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/locale/countries';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List EU countries
         *
         * List of all countries that are currently members of the EU. You can use the
         * locale header to get the data in a supported language.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listCountriesEU() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/locale/countries/eu';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List countries phone codes
         *
         * List of all countries phone codes. You can use the locale header to get the
         * data in a supported language.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listCountriesPhones() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/locale/countries/phones';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List currencies
         *
         * List of all currencies, including currency symbol, name, plural, and
         * decimal digits for all major and minor currencies. You can use the locale
         * header to get the data in a supported language.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listCurrencies() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/locale/currencies';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List languages
         *
         * List of all languages classified by ISO 639-1 including 2-letter code, name
         * in English, and name in the respective language.
         *
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listLanguages() {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/locale/languages';
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
    }

    class Storage extends Service {
        constructor(client) {
            super(client);
        }
        /**
         * List files
         *
         * Get a list of all the user files. You can use the query params to filter
         * your results.
         *
         * @param {string} bucketId
         * @param {string[]} queries
         * @param {string} search
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listFiles(bucketId, queries, search) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof bucketId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "bucketId"');
                }
                const apiPath = '/storage/buckets/{bucketId}/files'.replace('{bucketId}', bucketId);
                const payload = {};
                if (typeof queries !== 'undefined') {
                    payload['queries'] = queries;
                }
                if (typeof search !== 'undefined') {
                    payload['search'] = search;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create file
         *
         * Create a new file. Before using this route, you should create a new bucket
         * resource using either a [server
         * integration](https://appwrite.io/docs/server/storage#storageCreateBucket)
         * API or directly from your Appwrite console.
         *
         * Larger files should be uploaded using multiple requests with the
         * [content-range](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Range)
         * header to send a partial request with a maximum supported chunk of `5MB`.
         * The `content-range` header values should always be in bytes.
         *
         * When the first request is sent, the server will return the **File** object,
         * and the subsequent part request must include the file's **id** in
         * `x-appwrite-id` header to allow the server to know that the partial upload
         * is for the existing file and not for a new one.
         *
         * If you're creating a new file using one of the Appwrite SDKs, all the
         * chunking logic will be managed by the SDK internally.
         *
         *
         * @param {string} bucketId
         * @param {string} fileId
         * @param {File} file
         * @param {string[]} permissions
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createFile(bucketId, fileId, file, permissions, onProgress = (progress) => { }) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof bucketId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "bucketId"');
                }
                if (typeof fileId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "fileId"');
                }
                if (typeof file === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "file"');
                }
                const apiPath = '/storage/buckets/{bucketId}/files'.replace('{bucketId}', bucketId);
                const payload = {};
                if (typeof fileId !== 'undefined') {
                    payload['fileId'] = fileId;
                }
                if (typeof file !== 'undefined') {
                    payload['file'] = file;
                }
                if (typeof permissions !== 'undefined') {
                    payload['permissions'] = permissions;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                if (!(file instanceof File)) {
                    throw new AppwriteException('Parameter "file" has to be a File.');
                }
                const size = file.size;
                if (size <= Service.CHUNK_SIZE) {
                    return yield this.client.call('post', uri, {
                        'content-type': 'multipart/form-data',
                    }, payload);
                }
                const apiHeaders = {
                    'content-type': 'multipart/form-data',
                };
                let offset = 0;
                let response = undefined;
                if (fileId != 'unique()') {
                    try {
                        response = yield this.client.call('GET', new URL(this.client.config.endpoint + apiPath + '/' + fileId), apiHeaders);
                        offset = response.chunksUploaded * Service.CHUNK_SIZE;
                    }
                    catch (e) {
                    }
                }
                while (offset < size) {
                    let end = Math.min(offset + Service.CHUNK_SIZE - 1, size - 1);
                    apiHeaders['content-range'] = 'bytes ' + offset + '-' + end + '/' + size;
                    if (response && response.$id) {
                        apiHeaders['x-appwrite-id'] = response.$id;
                    }
                    const chunk = file.slice(offset, end + 1);
                    payload['file'] = new File([chunk], file.name);
                    response = yield this.client.call('post', uri, apiHeaders, payload);
                    if (onProgress) {
                        onProgress({
                            $id: response.$id,
                            progress: (offset / size) * 100,
                            sizeUploaded: offset,
                            chunksTotal: response.chunksTotal,
                            chunksUploaded: response.chunksUploaded
                        });
                    }
                    offset += Service.CHUNK_SIZE;
                }
                return response;
            });
        }
        /**
         * Get file
         *
         * Get a file by its unique ID. This endpoint response returns a JSON object
         * with the file metadata.
         *
         * @param {string} bucketId
         * @param {string} fileId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        getFile(bucketId, fileId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof bucketId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "bucketId"');
                }
                if (typeof fileId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "fileId"');
                }
                const apiPath = '/storage/buckets/{bucketId}/files/{fileId}'.replace('{bucketId}', bucketId).replace('{fileId}', fileId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update file
         *
         * Update a file by its unique ID. Only users with write permissions have
         * access to update this resource.
         *
         * @param {string} bucketId
         * @param {string} fileId
         * @param {string} name
         * @param {string[]} permissions
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateFile(bucketId, fileId, name, permissions) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof bucketId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "bucketId"');
                }
                if (typeof fileId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "fileId"');
                }
                const apiPath = '/storage/buckets/{bucketId}/files/{fileId}'.replace('{bucketId}', bucketId).replace('{fileId}', fileId);
                const payload = {};
                if (typeof name !== 'undefined') {
                    payload['name'] = name;
                }
                if (typeof permissions !== 'undefined') {
                    payload['permissions'] = permissions;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('put', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Delete File
         *
         * Delete a file by its unique ID. Only users with write permissions have
         * access to delete this resource.
         *
         * @param {string} bucketId
         * @param {string} fileId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        deleteFile(bucketId, fileId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof bucketId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "bucketId"');
                }
                if (typeof fileId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "fileId"');
                }
                const apiPath = '/storage/buckets/{bucketId}/files/{fileId}'.replace('{bucketId}', bucketId).replace('{fileId}', fileId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('delete', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Get file for download
         *
         * Get a file content by its unique ID. The endpoint response return with a
         * 'Content-Disposition: attachment' header that tells the browser to start
         * downloading the file to user downloads directory.
         *
         * @param {string} bucketId
         * @param {string} fileId
         * @throws {AppwriteException}
         * @returns {URL}
        */
        getFileDownload(bucketId, fileId) {
            if (typeof bucketId === 'undefined') {
                throw new AppwriteException('Missing required parameter: "bucketId"');
            }
            if (typeof fileId === 'undefined') {
                throw new AppwriteException('Missing required parameter: "fileId"');
            }
            const apiPath = '/storage/buckets/{bucketId}/files/{fileId}/download'.replace('{bucketId}', bucketId).replace('{fileId}', fileId);
            const payload = {};
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            return uri;
        }
        /**
         * Get file preview
         *
         * Get a file preview image. Currently, this method supports preview for image
         * files (jpg, png, and gif), other supported formats, like pdf, docs, slides,
         * and spreadsheets, will return the file icon image. You can also pass query
         * string arguments for cutting and resizing your preview image. Preview is
         * supported only for image files smaller than 10MB.
         *
         * @param {string} bucketId
         * @param {string} fileId
         * @param {number} width
         * @param {number} height
         * @param {string} gravity
         * @param {number} quality
         * @param {number} borderWidth
         * @param {string} borderColor
         * @param {number} borderRadius
         * @param {number} opacity
         * @param {number} rotation
         * @param {string} background
         * @param {string} output
         * @throws {AppwriteException}
         * @returns {URL}
        */
        getFilePreview(bucketId, fileId, width, height, gravity, quality, borderWidth, borderColor, borderRadius, opacity, rotation, background, output) {
            if (typeof bucketId === 'undefined') {
                throw new AppwriteException('Missing required parameter: "bucketId"');
            }
            if (typeof fileId === 'undefined') {
                throw new AppwriteException('Missing required parameter: "fileId"');
            }
            const apiPath = '/storage/buckets/{bucketId}/files/{fileId}/preview'.replace('{bucketId}', bucketId).replace('{fileId}', fileId);
            const payload = {};
            if (typeof width !== 'undefined') {
                payload['width'] = width;
            }
            if (typeof height !== 'undefined') {
                payload['height'] = height;
            }
            if (typeof gravity !== 'undefined') {
                payload['gravity'] = gravity;
            }
            if (typeof quality !== 'undefined') {
                payload['quality'] = quality;
            }
            if (typeof borderWidth !== 'undefined') {
                payload['borderWidth'] = borderWidth;
            }
            if (typeof borderColor !== 'undefined') {
                payload['borderColor'] = borderColor;
            }
            if (typeof borderRadius !== 'undefined') {
                payload['borderRadius'] = borderRadius;
            }
            if (typeof opacity !== 'undefined') {
                payload['opacity'] = opacity;
            }
            if (typeof rotation !== 'undefined') {
                payload['rotation'] = rotation;
            }
            if (typeof background !== 'undefined') {
                payload['background'] = background;
            }
            if (typeof output !== 'undefined') {
                payload['output'] = output;
            }
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            return uri;
        }
        /**
         * Get file for view
         *
         * Get a file content by its unique ID. This endpoint is similar to the
         * download method but returns with no  'Content-Disposition: attachment'
         * header.
         *
         * @param {string} bucketId
         * @param {string} fileId
         * @throws {AppwriteException}
         * @returns {URL}
        */
        getFileView(bucketId, fileId) {
            if (typeof bucketId === 'undefined') {
                throw new AppwriteException('Missing required parameter: "bucketId"');
            }
            if (typeof fileId === 'undefined') {
                throw new AppwriteException('Missing required parameter: "fileId"');
            }
            const apiPath = '/storage/buckets/{bucketId}/files/{fileId}/view'.replace('{bucketId}', bucketId).replace('{fileId}', fileId);
            const payload = {};
            const uri = new URL(this.client.config.endpoint + apiPath);
            payload['project'] = this.client.config.project;
            for (const [key, value] of Object.entries(Service.flatten(payload))) {
                uri.searchParams.append(key, value);
            }
            return uri;
        }
    }

    class Teams extends Service {
        constructor(client) {
            super(client);
        }
        /**
         * List teams
         *
         * Get a list of all the teams in which the current user is a member. You can
         * use the parameters to filter your results.
         *
         * @param {string[]} queries
         * @param {string} search
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        list(queries, search) {
            return __awaiter(this, void 0, void 0, function* () {
                const apiPath = '/teams';
                const payload = {};
                if (typeof queries !== 'undefined') {
                    payload['queries'] = queries;
                }
                if (typeof search !== 'undefined') {
                    payload['search'] = search;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create team
         *
         * Create a new team. The user who creates the team will automatically be
         * assigned as the owner of the team. Only the users with the owner role can
         * invite new members, add new owners and delete or update the team.
         *
         * @param {string} teamId
         * @param {string} name
         * @param {string[]} roles
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        create(teamId, name, roles) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                if (typeof name === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "name"');
                }
                const apiPath = '/teams';
                const payload = {};
                if (typeof teamId !== 'undefined') {
                    payload['teamId'] = teamId;
                }
                if (typeof name !== 'undefined') {
                    payload['name'] = name;
                }
                if (typeof roles !== 'undefined') {
                    payload['roles'] = roles;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Get team
         *
         * Get a team by its ID. All team members have read access for this resource.
         *
         * @param {string} teamId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        get(teamId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                const apiPath = '/teams/{teamId}'.replace('{teamId}', teamId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update name
         *
         * Update the team's name by its unique ID.
         *
         * @param {string} teamId
         * @param {string} name
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateName(teamId, name) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                if (typeof name === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "name"');
                }
                const apiPath = '/teams/{teamId}'.replace('{teamId}', teamId);
                const payload = {};
                if (typeof name !== 'undefined') {
                    payload['name'] = name;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('put', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Delete team
         *
         * Delete a team using its ID. Only team members with the owner role can
         * delete the team.
         *
         * @param {string} teamId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        delete(teamId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                const apiPath = '/teams/{teamId}'.replace('{teamId}', teamId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('delete', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * List team memberships
         *
         * Use this endpoint to list a team's members using the team's ID. All team
         * members have read access to this endpoint.
         *
         * @param {string} teamId
         * @param {string[]} queries
         * @param {string} search
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        listMemberships(teamId, queries, search) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                const apiPath = '/teams/{teamId}/memberships'.replace('{teamId}', teamId);
                const payload = {};
                if (typeof queries !== 'undefined') {
                    payload['queries'] = queries;
                }
                if (typeof search !== 'undefined') {
                    payload['search'] = search;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Create team membership
         *
         * Invite a new member to join your team. Provide an ID for existing users, or
         * invite unregistered users using an email or phone number. If initiated from
         * a Client SDK, Appwrite will send an email or sms with a link to join the
         * team to the invited user, and an account will be created for them if one
         * doesn't exist. If initiated from a Server SDK, the new member will be added
         * automatically to the team.
         *
         * You only need to provide one of a user ID, email, or phone number. Appwrite
         * will prioritize accepting the user ID > email > phone number if you provide
         * more than one of these parameters.
         *
         * Use the `url` parameter to redirect the user from the invitation email to
         * your app. After the user is redirected, use the [Update Team Membership
         * Status](https://appwrite.io/docs/references/cloud/client-web/teams#updateMembershipStatus)
         * endpoint to allow the user to accept the invitation to the team.
         *
         * Please note that to avoid a [Redirect
         * Attack](https://github.com/OWASP/CheatSheetSeries/blob/master/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.md)
         * Appwrite will accept the only redirect URLs under the domains you have
         * added as a platform on the Appwrite Console.
         *
         *
         * @param {string} teamId
         * @param {string[]} roles
         * @param {string} email
         * @param {string} userId
         * @param {string} phone
         * @param {string} url
         * @param {string} name
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        createMembership(teamId, roles, email, userId, phone, url, name) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                if (typeof roles === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "roles"');
                }
                const apiPath = '/teams/{teamId}/memberships'.replace('{teamId}', teamId);
                const payload = {};
                if (typeof email !== 'undefined') {
                    payload['email'] = email;
                }
                if (typeof userId !== 'undefined') {
                    payload['userId'] = userId;
                }
                if (typeof phone !== 'undefined') {
                    payload['phone'] = phone;
                }
                if (typeof roles !== 'undefined') {
                    payload['roles'] = roles;
                }
                if (typeof url !== 'undefined') {
                    payload['url'] = url;
                }
                if (typeof name !== 'undefined') {
                    payload['name'] = name;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('post', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Get team membership
         *
         * Get a team member by the membership unique id. All team members have read
         * access for this resource.
         *
         * @param {string} teamId
         * @param {string} membershipId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        getMembership(teamId, membershipId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                if (typeof membershipId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "membershipId"');
                }
                const apiPath = '/teams/{teamId}/memberships/{membershipId}'.replace('{teamId}', teamId).replace('{membershipId}', membershipId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update membership
         *
         * Modify the roles of a team member. Only team members with the owner role
         * have access to this endpoint. Learn more about [roles and
         * permissions](https://appwrite.io/docs/permissions).
         *
         *
         * @param {string} teamId
         * @param {string} membershipId
         * @param {string[]} roles
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateMembership(teamId, membershipId, roles) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                if (typeof membershipId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "membershipId"');
                }
                if (typeof roles === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "roles"');
                }
                const apiPath = '/teams/{teamId}/memberships/{membershipId}'.replace('{teamId}', teamId).replace('{membershipId}', membershipId);
                const payload = {};
                if (typeof roles !== 'undefined') {
                    payload['roles'] = roles;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('patch', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Delete team membership
         *
         * This endpoint allows a user to leave a team or for a team owner to delete
         * the membership of any other team member. You can also use this endpoint to
         * delete a user membership even if it is not accepted.
         *
         * @param {string} teamId
         * @param {string} membershipId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        deleteMembership(teamId, membershipId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                if (typeof membershipId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "membershipId"');
                }
                const apiPath = '/teams/{teamId}/memberships/{membershipId}'.replace('{teamId}', teamId).replace('{membershipId}', membershipId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('delete', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update team membership status
         *
         * Use this endpoint to allow a user to accept an invitation to join a team
         * after being redirected back to your app from the invitation email received
         * by the user.
         *
         * If the request is successful, a session for the user is automatically
         * created.
         *
         *
         * @param {string} teamId
         * @param {string} membershipId
         * @param {string} userId
         * @param {string} secret
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updateMembershipStatus(teamId, membershipId, userId, secret) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                if (typeof membershipId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "membershipId"');
                }
                if (typeof userId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "userId"');
                }
                if (typeof secret === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "secret"');
                }
                const apiPath = '/teams/{teamId}/memberships/{membershipId}/status'.replace('{teamId}', teamId).replace('{membershipId}', membershipId);
                const payload = {};
                if (typeof userId !== 'undefined') {
                    payload['userId'] = userId;
                }
                if (typeof secret !== 'undefined') {
                    payload['secret'] = secret;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('patch', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Get team preferences
         *
         * Get the team's shared preferences by its unique ID. If a preference doesn't
         * need to be shared by all team members, prefer storing them in [user
         * preferences](https://appwrite.io/docs/references/cloud/client-web/account#getPrefs).
         *
         * @param {string} teamId
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        getPrefs(teamId) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                const apiPath = '/teams/{teamId}/prefs'.replace('{teamId}', teamId);
                const payload = {};
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('get', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
        /**
         * Update preferences
         *
         * Update the team's preferences by its unique ID. The object you pass is
         * stored as is and replaces any previous value. The maximum allowed prefs
         * size is 64kB and throws an error if exceeded.
         *
         * @param {string} teamId
         * @param {object} prefs
         * @throws {AppwriteException}
         * @returns {Promise}
        */
        updatePrefs(teamId, prefs) {
            return __awaiter(this, void 0, void 0, function* () {
                if (typeof teamId === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "teamId"');
                }
                if (typeof prefs === 'undefined') {
                    throw new AppwriteException('Missing required parameter: "prefs"');
                }
                const apiPath = '/teams/{teamId}/prefs'.replace('{teamId}', teamId);
                const payload = {};
                if (typeof prefs !== 'undefined') {
                    payload['prefs'] = prefs;
                }
                const uri = new URL(this.client.config.endpoint + apiPath);
                return yield this.client.call('put', uri, {
                    'content-type': 'application/json',
                }, payload);
            });
        }
    }

    class Permission {
    }
    Permission.read = (role) => {
        return `read("${role}")`;
    };
    Permission.write = (role) => {
        return `write("${role}")`;
    };
    Permission.create = (role) => {
        return `create("${role}")`;
    };
    Permission.update = (role) => {
        return `update("${role}")`;
    };
    Permission.delete = (role) => {
        return `delete("${role}")`;
    };

    /**
     * Helper class to generate role strings for `Permission`.
     */
    class Role {
        /**
         * Grants access to anyone.
         *
         * This includes authenticated and unauthenticated users.
         *
         * @returns {string}
         */
        static any() {
            return 'any';
        }
        /**
         * Grants access to a specific user by user ID.
         *
         * You can optionally pass verified or unverified for
         * `status` to target specific types of users.
         *
         * @param {string} id
         * @param {string} status
         * @returns {string}
         */
        static user(id, status = '') {
            if (status === '') {
                return `user:${id}`;
            }
            return `user:${id}/${status}`;
        }
        /**
         * Grants access to any authenticated or anonymous user.
         *
         * You can optionally pass verified or unverified for
         * `status` to target specific types of users.
         *
         * @param {string} status
         * @returns {string}
         */
        static users(status = '') {
            if (status === '') {
                return 'users';
            }
            return `users/${status}`;
        }
        /**
         * Grants access to any guest user without a session.
         *
         * Authenticated users don't have access to this role.
         *
         * @returns {string}
         */
        static guests() {
            return 'guests';
        }
        /**
         * Grants access to a team by team ID.
         *
         * You can optionally pass a role for `role` to target
         * team members with the specified role.
         *
         * @param {string} id
         * @param {string} role
         * @returns {string}
         */
        static team(id, role = '') {
            if (role === '') {
                return `team:${id}`;
            }
            return `team:${id}/${role}`;
        }
        /**
         * Grants access to a specific member of a team.
         *
         * When the member is removed from the team, they will
         * no longer have access.
         *
         * @param {string} id
         * @returns {string}
         */
        static member(id) {
            return `member:${id}`;
        }
        /**
         * Grants access to a user with the specified label.
         *
         * @param {string} name
         * @returns  {string}
         */
        static label(name) {
            return `label:${name}`;
        }
    }

    class ID {
        static custom(id) {
            return id;
        }
        static unique() {
            return 'unique()';
        }
    }

    exports.Account = Account;
    exports.AppwriteException = AppwriteException;
    exports.Avatars = Avatars;
    exports.Client = Client;
    exports.Databases = Databases;
    exports.Functions = Functions;
    exports.Graphql = Graphql;
    exports.ID = ID;
    exports.Locale = Locale;
    exports.Permission = Permission;
    exports.Query = Query;
    exports.Role = Role;
    exports.Storage = Storage;
    exports.Teams = Teams;

    Object.defineProperty(exports, '__esModule', { value: true });

})(this.Appwrite = this.Appwrite || {});
