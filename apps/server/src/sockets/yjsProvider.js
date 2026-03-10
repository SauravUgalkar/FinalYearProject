const Y = require('yjs');
const { encoding, decoding } = require('lib0');

/**
 * YJS Provider for collaborative editing
 * Manages shared Yjs documents per file in each room
 */
class YjsProvider {
  constructor() {
    this.docs = new Map(); // Map of docId -> Yjs Doc
    this.clients = new Map(); // Map of docId -> Set of connected clients
  }

  /**
   * Get or create a shared document for a file
   * @param {string} roomId - Room identifier
   * @param {string} fileName - File name
   * @returns {Y.Doc} - Yjs document for the file
   */
  getDoc(roomId, fileName) {
    const docId = `${roomId}:${fileName}`;
    
    if (!this.docs.has(docId)) {
      const ydoc = new Y.Doc();
      this.docs.set(docId, ydoc);
      this.clients.set(docId, new Set());
    }

    return this.docs.get(docId);
  }

  /**
   * Initialize a document with content
   * @param {string} roomId - Room identifier
   * @param {string} fileName - File name
   * @param {string} content - Initial content
   */
  initializeDoc(roomId, fileName, content) {
    const docId = `${roomId}:${fileName}`;
    const ydoc = this.getDoc(roomId, fileName);

    // Only initialize if empty
    if (ydoc.share.size === 0) {
      const ytext = ydoc.getText('shared-text');
      ytext.insert(0, content);
    }
  }

  /**
   * Get current content of a document
   * @param {string} roomId - Room identifier
   * @param {string} fileName - File name
   * @returns {string} - Current document content
   */
  getContent(roomId, fileName) {
    const ydoc = this.getDoc(roomId, fileName);
    const ytext = ydoc.getText('shared-text');
    return ytext.toString();
  }

  /**
   * Get document state as binary for sync
   * @param {string} roomId - Room identifier
   * @param {string} fileName - File name
   * @returns {Uint8Array} - State vector
   */
  getState(roomId, fileName) {
    const ydoc = this.getDoc(roomId, fileName);
    return Y.encodeStateAsUpdate(ydoc);
  }

  /**
   * Apply an update from a client
   * @param {string} roomId - Room identifier
   * @param {string} fileName - File name
   * @param {Uint8Array} update - Update bytes from client
   */
  applyUpdate(roomId, fileName, update) {
    const ydoc = this.getDoc(roomId, fileName);
    Y.applyUpdate(ydoc, new Uint8Array(update));
  }

  /**
   * Register a client connection
   * @param {string} roomId - Room identifier
   * @param {string} fileName - File name
   * @param {string} clientId - Client/socket ID
   */
  addClient(roomId, fileName, clientId) {
    const docId = `${roomId}:${fileName}`;
    const clients = this.clients.get(docId);
    if (clients) {
      clients.add(clientId);
    }
  }

  /**
   * Unregister a client connection
   * @param {string} roomId - Room identifier
   * @param {string} fileName - File name
   * @param {string} clientId - Client/socket ID
   */
  removeClient(roomId, fileName, clientId) {
    const docId = `${roomId}:${fileName}`;
    const clients = this.clients.get(docId);
    if (clients) {
      clients.delete(clientId);
      
      // Clean up if no more clients
      if (clients.size === 0) {
        this.docs.delete(docId);
        this.clients.delete(docId);
      }
    }
  }

  /**
   * Get all connected clients for a document
   * @param {string} roomId - Room identifier
   * @param {string} fileName - File name
   * @returns {Set<string>} - Set of client IDs
   */
  getClients(roomId, fileName) {
    const docId = `${roomId}:${fileName}`;
    return this.clients.get(docId) || new Set();
  }

  /**
   * Clean up a document
   * @param {string} roomId - Room identifier
   * @param {string} fileName - File name
   */
  cleanup(roomId, fileName) {
    const docId = `${roomId}:${fileName}`;
    const ydoc = this.docs.get(docId);
    if (ydoc) {
      ydoc.destroy();
      this.docs.delete(docId);
      this.clients.delete(docId);
    }
  }

  /**
   * Clean up all documents in a room
   * @param {string} roomId - Room identifier
   */
  cleanupRoom(roomId) {
    for (const docId of this.docs.keys()) {
      if (docId.startsWith(`${roomId}:`)) {
        this.cleanup(roomId, docId.substring(roomId.length + 1));
      }
    }
  }
}

module.exports = new YjsProvider();
