/**
 * Veeva Vault REST API wrapper.
 *
 * Usage:
 * - Begin by calling the authenticate() method
 * - This will store the session ID for use in all later API calls
 * - Note that all methods return a Promise
 *
 * Any API request that is unsuccessful will throw an error.
 *
 * History:
 * v0.1.0 (2019-03-15)
 * - initial development, based on smartrep-vault-upload.js
 */

// Include our library dependencies.
const extend = require("extend");
const q = require("q");
const rp = require("request-promise");

/**
 * Record the current authenticated Vault session for API requests.
 * - id = (string) authenticated session id
 * - host = (string) domain to make REST API calls to
 *     e.g. https://agency.veevavault.com/api/v13.0/
 */
var session = {
  id: null,
  host: null
};

var config = {
  verbose: false
};

/**
 * Authenticate a user to the Vault API and get a session ID.
 *
 * The host string should end with a trailing slash. (One will be added
 * automatically if it doesn't end with one.)
 *
 * @param object credentials
 * {
 *   host: string api url e.g., "https://vv.veevavault.com/api/v13.0/"
 *   username: string
 *   password: string
 * }
 */
var authenticate = function(credentials) {
  // Ensure the given host name ends in a slash. All API requests we make will
  // append to the host name and assume it ends in a slash.
  credentials.host = credentials.host.replace(/[\s]{1,}$/, "");
  credentials.host +=
    credentials.host[credentials.host.length - 1] == "/" ? "" : "/";

  var payload = extend(_payloadTemplate(), payload, {
    uri: credentials.host + "auth",
    method: "POST",
    headers: {},
    form: {
      username: credentials.username,
      password: credentials.password
    }
  });

  return rp(payload).then(function(result) {
    _handleError("authenticate", result);

    session.host = credentials.host;
    session.id = result.sessionId;
  });
};

/**
 * Get a list of vault objects of a given type.
 *
 * @param string object_type
 *   The Vault object type. For example:
 *   - product__v
 *   - country__v
 *   - study__v
 *
 * There may be others based on the application and configuration.
 *
 * @return (promise-wrapped) array of objects
 * [
 *   {
 *     id: "some-value",
 *     name__v: "Object Name 1"
 *   },
 *   { ... }
 * ]
 */
const getVaultObjects = function(object_type) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "vobjects/" + object_type
  });

  return rp(payload).then(function(all_objects) {
    _handleError("getVaultObjects", all_objects, "object_type = " + object_type);

    return all_objects.data;
  });
};

/**
 * Get all products defined in our vault.
 *
 * Note: this is just a convenience method for getVaultObjects().
 */
const getProducts = function() {
  return getVaultObjects("product__v");
};

/**
 * Get all countries defined in our vault.
 *
 * Note: this is just a convenience method for getVaultObjects().
 */
const getCountries = function() {
  return getVaultObjects("country__v");
};

/**
 * Get all binders defined in our vault.
 *
 * @return (promise-wrapped) array of binder objects
 *
 * An individual binder object contains the following properties that we care
 * about:
 *   binder = {
 *     document: {
 *       id: int
 *       binder__v: boolean (must be true for binders)
 *       crm_presentation_id__v: = veeva presentation id
 *       name__v: presentation name
 *       title__v: presentation title
 *       status__v: 'Draft'
 *       clm_content__v: true
 *     },
 *     versions: [
 *     ],
 *     binder: {
 *       nodes: [
 *         {
 *           properties: {
 *             document_id__v: int
 *             order__v: int
 *             name__v: string
 *           }
 *         },
 *         { .. }
 *       ],
 *     }
 *   }
 */
const getBinders = function() {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/documents"
  });

  return rp(payload).then(function(result) {
    _handleError("getBinders", result);

    var binders = [];

    for (var i = 0; i < result.documents.length; i++) {
      var document = result.documents[i].document;

      if (document.binder__v == true) {
        binders.push(document);
      }
    }

    return binders;
  });
};

/**
 * Get the binder object for the given binder id.
 *
 * @return (promise-wrapped) object binder
 *   see getBinders() for a binder object example
 */
const getBinder = function(binder_id) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/binders/" + binder_id
  });

  return rp(payload).then(function(result) {
    _handleError("getBinder", result, "binder_id = " + binder_id);

    return result;
  });
};

/**
 * Get the node ids and document ids for all documents in the given binder.
 *
 * @return (promise-wrapped) array of objects
 * [
 *   {
 *     node_id: specific node id for this document reference
 *     document_id: document id of the object in this binder
 *   },
 *   { ... }
 * ]
 */
const getBinderDocuments = function(binder_id) {
  return getBinder(binder_id).then(function(binder) {
    var documents = [];

    // Assemble a list of all documents assigned to this binder. We'll need the
    // node id if we want to remove a document from the binder.
    Array.prototype.forEach.call(binder.binder.nodes, function(node) {
      documents.push({
        node_id: node.properties.id,
        document_id: node.properties.document_id__v
      });
    });

    return documents;
  });
};

/**
 * Remove the specified documents from the given binder.
 *
 * When complete, the documents referenced in 'documents' will no longer be
 * associated with the binder. Documents are not actually deleted.
 *
 * @param int binder_id - the binder we're changing document associations for
 * @param array documents - array of document objects, e.g.
 * [
 *   {
 *     node_id: specific node id for this document reference
 *     document_id: document id of the object in this binder
 *   },
 *   { ... }
 * ]
 *
 *   OR
 *
 * @param array documents = array of document node_ids
 */
const removeBinderDocuments = function(binder_id, documents) {
  if (documents.length == 0) {
    return new q();
  }

  // Recursively keep taking the first document object off the stack.
  var node_id = documents[0];

  // Normalize the variable to account for whether we received an individual
  // node_id string, or an object containing the node_id and document_id.
  if (typeof node_id === "object") {
    node_id = node_id.node_id;
  }
  documents = documents.slice(1);

  var payload = extend(_payloadTemplate(), payload, {
    uri:
      session.host + "objects/binders/" + binder_id + "/documents/" + node_id,
    method: "DELETE"
  });

  return rp(payload).then(function(result) {
    _handleError(
      "removeBinderDocuments",
      result,
      "binder_id = " + binder_id + ", node_id = " + node_id
    );

    return removeBinderDocuments(binder_id, documents);
  });
};

/**
 * Associate the given documents with the given binder. Documents will be
 * ordered in the order they are found in document_ids.
 *
 * @param int binder_id - the binder we're changing document associations for
 * @param array document_ids - array of document ids to put in this binder
 * (@param int index - used internally to keep track of sort order)
 */
const setBinderDocuments = function(binder_id, document_ids, index) {
  if (document_ids.length == 0) {
    return new q();
  }

  if (typeof index !== "number") {
    index = 1;
  }

  // Recursively keep taking the first document id off the stack.
  var document_id = document_ids[0];
  document_ids = document_ids.slice(1);

  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/binders/" + binder_id + "/documents",
    method: "POST",
    form: {
      document_id__v: document_id,
      order__v: index
    }
  });

  return rp(payload).then(function(result) {
    _handleError(
      "setBinderDocuments",
      result,
      "binder_id = " +
        binder_id +
        ", document_id = " +
        document_id +
        ", index = " +
        index
    );

    index++;
    return setBinderDocuments(binder_id, document_ids, index);
  });
};

/**
 * Create a new binder in Vault.
 *
 * @param object binder_data
 *
 * Expect the binder object to be something like this:
 * {
 *   name__v: "your presentation description",
 *   title__v: "your presentation title",
 *   type__v: "Multichannel Presentation",
 *   lifecycle__v: "Binder Lifecycle",
 *   clm_content__v: true,
 *   crm_media_type__v: "HTML",
 *   status__v: "Draft",
 *   country__v: "unitedStates", (the country id)
 *   language__v: (unknown if this is used)
 *   country_tpi__c: (unknown if this is used)
 *   product__v: "product id string",
 *   major_version_number__v: "0",
 *   minor_version_number__v: "1",
 *   crm_presentation_id__v: "your_presentation_id",
 *   production__c: (unknown if this is used, or what for)
 * }
 *
 * @return binder object (identical to that from getBinder() method)
 */
const createBinder = function(binder_data) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/binders",
    method: "POST",
    form: binder_data
  });

  return rp(payload).then(function(result) {
    _handleError(
      "createBinder",
      result,
      "binder_data.title__v = " + binder_data.title__v
    );

    return vault.getBinder(result.id);
  });
};

/**
 * Update an existing binder object in Vault.
 *
 * @param int binder_id - existing vault object id to update
 * @param object binder_data - new binder form data to submit
 */
const updateBinder = function(binder_id, binder_data) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/binders/" + binder_id,
    method: "PUT",
    form: binder_data
  });

  return rp(payload).then(function(result) {
    _handleError(
      "updateBinder",
      result,
      "binder_id = " +
        binder_id +
        ", binder_data.name__v = " +
        binder_data.name__v
    );
  });
};

/**
 * Delete an existing binder from Vault.
 *
 * @param int binder_id - existing vault object id to delete
 */
const deleteBinder = function(binder_id) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/binders/" + binder_id,
    method: "DELETE"
  });

  return rp(payload).then(function(result) {
    _handleError("deleteBinder", result, "binder_id = " + binder_id);
  });
};

/**
 * Create a new document in Vault.
 *
 * Note that we must use 'formData' and not 'form' in order to successfully
 * upload the zip file for this document.
 *
 * @param object document_data
 *   Field values for the new vault document to create
 *
 * @return Vault ID of the created document
 */
const createDocument = function(document_data) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/documents",
    method: "POST",
    formData: document_data
  });

  return rp(payload).then(function(result) {
    _handleError(
      "createDocument",
      result,
      "document.name__v = " + document_data.name__v
    );

    return result.id;
  });
};

/**
 * Update a Vault document.
 *
 * Updating a document is done in 3 steps:
 * - lock the document
 * - update it
 * - unlock it
 *
 * @param int document_id
 *   id of the vault document we're updating
 * @param object document_data
 *   fields (and values) to update for the existing document
 *
 * @return int document_id that was updated
 */
const updateDocument = function(document_id, document_data) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/documents/" + document_id,
    method: "PUT",
    form: document_data
  });

  return rp(payload).then(function(result) {
    _handleError(
      "updateDocument",
      result,
      "document.id = " +
        document_id +
        ", document_data.name__v = " +
        document_data.name__v
    );

    return result.id;
  });
};

/**
 * Update the file content associated with a Vault document.
 *
 * Note that we're using 'formData' rather than 'form' here. We also require
 * the 'type: "update"' property.
 *
 * @param int document_id - Vault document id we're updating
 * @param object document_file (ReadStream from node's file-system createReadStream)
 */
const updateDocumentFile = function(document_id, document_file) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/documents/" + document_id,
    type: "update",
    method: "POST",
    formData: {
      file: document_file
    }
  });

  // Lock the document, update it, then unlock it.
  // Note: This fails if we call it just after we've created a document.
  return lockDocument(document_id).then(function() {
    return rp(payload).then(function(result) {
      _handleError(
        "updateDocumentFile",
        result,
        "document.id = " + document_id
      );
      return unlockDocument(document_id);
    });
  });
};

/**
 * Make a Vault document a shared resource of another Vault document.
 *
 * @param object document
 * {
 *   id: int id of the vault document we're updating
 *   version_major: int major version number of the document we're updating
 *   version_minor: int minor version number of the document we're updating
 * }
 * @param int shared_document_id - id of the shared document to associate with this one
 */
const createDocumentRelationship = function(document, shared_document_id) {
  var path = _getRelationshipsPath(document);
  var payload = extend(_payloadTemplate(), payload, {
    url: session.host + path,
    method: "POST",
    form: {
      relationship_type__v: "related_shared_resource__v",
      target_doc_id__v: shared_document_id
    }
  });

  return rp(payload).then(function(result) {
    _handleError(
      "createDocumentRelationship",
      result,
      "document_id = " +
        document.id +
        ", shared_document_id = " +
        shared_document_id
    );
  });
};

/**
 * Get the shared content relationships for a given Vault document.
 *
 * @param object document
 * {
 *   id: int id of the vault document we're getting content relationships for
 *   version_major: int major version number of the document we're updating
 *   version_minor: int minor version number of the document we're updating
 * }
 *
 * @return array of relationship objects e.g.
 * [
 *   {
 *     relationship: {
 *       id: relationship_id for this relationship
 *       source_doc_id__v: Vault ID of the document we're getting relationships for
 *       target_doc_id__v: Vault ID of the document to share
 *     }
 *   },
 *   { ... }
 * ]
 */
const getDocumentRelationships = function(document) {
  var path = _getRelationshipsPath(document);
  var payload = extend(_payloadTemplate(), payload, {
    url: session.host + path
  });

  return rp(payload).then(function(result) {
    _handleError(
      "getDocumentRelationships",
      result,
      "document_id = " +
        document.id +
        ", version_major = " +
        document.version_major +
        ", version_minor = " +
        document.version_minor
    );

    return result.relationships;
  });
};

/**
 * Remove a shared document relationship from a Vault document.
 *
 * @param object document
 * {
 *   id: int id of the vault document we're updating
 *   version_major: int major version number of the document we're updating
 *   version_minor: int minor version number of the document we're updating
 * }
 * @param int relationship_id - id of the shared document relationship to remove
 */
const removeDocumentRelationship = function(document, relationship_id) {
  var path = _getRelationshipsPath(document);
  var payload = extend(_payloadTemplate(), payload, {
    url: session.host + path + "/" + relationship_id,
    method: "DELETE"
  });

  return rp(payload).then(function(result) {
    _handleError(
      "removeDocumentRelationship",
      result,
      "document_id = " +
        document.id +
        ", version_major = " +
        document.version_major +
        ", version_minor = " +
        document.version_minor +
        ", relationship_id = " +
        relationship_id
    );
  });
};

/**
 * Construct the path to a document relationships API call.
 *
 * @param object document e.g.:
 * {
 *   id: int id of the vault document we're updating
 *   version_major: int major version number of the document we're updating
 *   version_minor: int minor version number of the document we're updating
 * }
 *
 * @return string e.g. "objects/documents/123/versions/0/15/relationships"
 */
const _getRelationshipsPath = function(document) {
  var path = [
    "objects",
    "documents",
    document.id,
    "versions",
    document.version_major,
    document.version_minor,
    "relationships"
  ];

  return path.join("/");
};

/**
 * Retrieve a document from Vault.
 *
 * @param int document_id
 *   Vault id of the document to retrieve
 *
 * @return object Vault object with Vault keys and values for the found document
 */
const getDocument = function(document_id) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/documents/" + document_id,
    method: "GET"
  });

  return rp(payload).then(function(result) {
    _handleError("getDocument", result, "document_id = " + document_id);

    return result.document;
  });
};

/**
 * Delete a document from Vault.
 *
 * Note that we cannot delete documents that are assigned to a binder.
 *
 * @param int document_id
 *   Vault id of the document to delete
 */
const deleteDocument = function(document_id) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/documents/" + document_id,
    method: "DELETE"
  });

  return rp(payload).then(function(result) {
    _handleError("deleteDocument", result, "document_id = " + document_id);
  });

};

/**
 * Lock (check out) a Vault document.
 *
 * @param int document_id
 *   Vault id of the document to lock
 */
const lockDocument = function(document_id) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/documents/" + document_id + "/lock",
    method: "POST"
  });

  return rp(payload).then(function(result) {
    _handleError("lockDocument", result, "document_id = " + document_id);
  });
};

/**
 * Unlock (check in) a Vault document.
 *
 * @param int document_id
 *   Vault id of the document to unlock
 */
const unlockDocument = function(document_id) {
  var payload = extend(_payloadTemplate(), payload, {
    uri: session.host + "objects/documents/" + document_id + "/lock",
    method: "DELETE"
  });

  return rp(payload).then(function(result) {
    _handleError("unlockDocument", result, "document_id = " + document_id);
  });
};

/**
 * Tell the module to be chatty, or not.
 *
 * @param boolean show_messages
 *   - if true (or truthy), all module methods will output their status
 *   - if false, the module will be silent
 */
var verbose = function(show_messages) {
  config.verbose = show_messages == true ? true : false;
};

/**
 * Define the default REST API payload.
 *
 * Each API call in this library extends this payload for the specific API
 * call requirements.
 *
 * @param object session
 * {
 *   id: "session-id-string",
 *   host: "https://domain.com/url/"
 * }
 */
const _payloadTemplate = function() {
  return {
    method: "GET",
    headers: {
      Authorization: session.id
    },
    json: true
  };
};

/**
 * Evaluate a Veeva REST API result object.
 *
 * If it was not successful, throw an error message.
 *
 * @param string method - name of method where the API call was called
 * @param object result - JSON object returned from the API call
 */
const _handleError = function(method, result, args) {
  var args_message = "(";
  args_message += typeof args === "string" ? " " + args + " " : "";
  args_message += ")";

  if (result.responseStatus !== "SUCCESS") {
    var message = "Error in vault." + method + args_message + ": ";

    if (typeof result.responseMessage != "undefined") {
      throw new Error(message + result.responseMessage);
    } else if (typeof result.errors != "undefined") {
      _output(message, result.errors);
      throw new Error(message + "Aborting");
    } else {
      throw new Error(message + "Aborting");
    }
  } else {
    var message = "vault." + method + args_message + ": OK";
    _output(message);
  }
};

/**
 * Output a status message.
 *
 * Messages are only output if the module is configured to be 'verbose'.
 */
const _output = function(message) {
  if (config.verbose === true) {
    console.log(message);
  }
};

/**
 * Define the public API.
 */
const vault = {
  authenticate: authenticate,

  getVaultObjects: getVaultObjects,
  getProducts: getProducts,
  getCountries: getCountries,

  getBinders: getBinders,
  getBinder: getBinder,
  createBinder: createBinder,
  updateBinder: updateBinder,
  deleteBinder: deleteBinder,

  getBinderDocuments: getBinderDocuments,
  setBinderDocuments: setBinderDocuments,
  removeBinderDocuments: removeBinderDocuments,

  getDocument: getDocument,
  createDocument: createDocument,
  updateDocument: updateDocument,
  updateDocumentFile: updateDocumentFile,
  deleteDocument: deleteDocument,
  lockDocument: lockDocument,
  unlockDocument: unlockDocument,

  getDocumentRelationships: getDocumentRelationships,
  createDocumentRelationship: createDocumentRelationship,
  removeDocumentRelationship: removeDocumentRelationship,

  verbose: verbose
};

module.exports = vault;
