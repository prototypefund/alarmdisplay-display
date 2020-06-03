const DuplicateEntryError = require('../../errors/DuplicateEntryError')
const Repository = require('./Repository')

class ContentSlotRepository extends Repository {
  /**
   * @param connectionPool
   * @param {String} prefix The prefix used for the database tables
   */
  constructor (connectionPool, prefix) {
    super(undefined, `${prefix}contentslots`)
    this.connectionPool = connectionPool
    this.optionsTableName = `${prefix}contentslot_options`
  }

  /**
   * @param {String} componentType
   * @param {Number} viewId
   * @param {Number} columnStart
   * @param {Number} rowStart
   * @param {Number} columnEnd
   * @param {Number} rowEnd
   * @param {Object} options
   *
   * @return {Promise<Number>}
   */
  async createContentSlot (componentType, viewId, columnStart, rowStart, columnEnd, rowEnd, options) {
    let conn
    try {
      conn = await this.connectionPool.getConnection()
      const insertResult = await conn.query(
        `INSERT INTO ${this.tableName} (\`view_id\`, \`component_type\`, \`column_start\`, \`row_start\`, \`column_end\`, \`row_end\`) VALUES (?,?,?,?,?,?)`,
        [viewId, componentType, columnStart, rowStart, columnEnd, rowEnd]
      )
      const contentSlotId = insertResult.insertId
      await this.setOptionsForContentSlot(conn, contentSlotId, options)
      return contentSlotId
    } catch (e) {
      if (e.errno === 1062) {
        throw new DuplicateEntryError(e.code)
      }

      throw new Error(e.code)
    } finally {
      if (conn) {
        conn.release()
      }
    }
  }

  /**
   * @param {Number} id The ID of the item to delete
   *
   * @return {Promise<Number>|Promise<null>} Returns the ID if the item existed before deletion, null otherwise
   */
  async deleteOne (id) {
    let conn
    try {
      conn = await this.connectionPool.getConnection()
      const result = await conn.query(`DELETE FROM ${this.tableName} WHERE id = ? LIMIT 1`, id)
      return (result.affectedRows === 1 ? id : null)
    } finally {
      if (conn) {
        conn.release()
      }
    }
  }

  /**
   * Finds and returns Content Slot objects that belong to a certain View.
   *
   * @param {Number} viewId The ID of the View
   *
   * @return {Promise<Object[]>}
   */
  async getContentSlotsByViewId (viewId) {
    let conn
    try {
      conn = await this.connectionPool.getConnection()
      const rows = await conn.query(`SELECT * FROM ${this.tableName} WHERE view_id = ?`, viewId)

      if (rows.length === 0) {
        return []
      }

      // Get options for all found content slots
      const contentSlotIds = rows.map(row => row.id)
      const options = await this.getOptionsForContentSlots(conn, contentSlotIds)
      return rows.map(row => {
        // Combine each content slot row with the option rows belonging to that content slot
        return this.rowToObjectWithOptions(row, options.get(row.id))
      })
    } finally {
      if (conn) {
        conn.release()
      }
    }
  }

  /**
   * Finds and returns Content Slot objects that contain a certain type of Component.
   *
   * @param {String} componentType The type of the Component that should be displayed in this Content Slot
   *
   * @return {Promise<Object[]>}
   */
  async getContentSlotsByComponentType (componentType) {
    let conn
    try {
      conn = await this.connectionPool.getConnection()
      const rows = await conn.query(`SELECT * FROM ${this.tableName} WHERE component_type = ?`, componentType)
      return rows.map(this.rowToObject)
    } finally {
      if (conn) {
        conn.release()
      }
    }
  }

  /**
   * @param conn An open connection to the database
   * @param id
   *
   * @return {Promise<Map<String,String>>}
   */
  async getOptionsForContentSlot (conn, id) {
    const rows = await conn.query(`SELECT * FROM ${this.optionsTableName} WHERE contentslot_id = ?`, id)
    const options = new Map()
    rows.forEach(row => {
      options.set(row.name, row.value)
    })
    return options
  }

  /**
   * @param conn An open connection to the database
   * @param ids
   *
   * @return {Promise<Map<Number,Map<String,String>>>} A Map of Maps, keyed by component ID, then by option name
   */
  async getOptionsForContentSlots (conn, ids) {
    const rows = await conn.query(`SELECT * FROM ${this.optionsTableName} WHERE contentslot_id IN ?`, [ids])

    // Initialize the Map with a Map for each content slot
    const options = new Map()
    ids.forEach(id => {
      options.set(id, new Map())
    })

    // Fill the Maps
    rows.forEach(({ contentslot_id: id, name, value }) => {
      options.get(id).set(name, value)
    })
    return options
  }

  /**
   * @param conn An open connection to the database
   * @param {Number} id The ID of the content slot
   * @param {Object} options
   *
   * @return {Promise<Boolean>}
   */
  async setOptionsForContentSlot (conn, id, options = {}) {
    let optionsChanged = false
    const existingOptions = await this.getOptionsForContentSlot(conn, id)
    // Remove existing options not present in the new options object
    for (const key of existingOptions.keys()) {
      if (!Object.prototype.hasOwnProperty.call(options, key)) {
        await conn.query(`DELETE FROM ${this.optionsTableName} WHERE contentslot_id = ? AND name = ?`, [id, key])
        optionsChanged = true
      }
    }

    for (const [key, value] of Object.entries(options)) {
      if (existingOptions.has(key)) {
        const updateResult = await conn.query(
          `UPDATE ${this.optionsTableName} SET \`value\` = ? WHERE \`contentslot_id\` = ? AND \`name\` = ?`,
          [value, id, key]
        )
        if (updateResult.affectedRows === 1) {
          optionsChanged = true
        }
        continue
      }

      await conn.query(
        `INSERT INTO ${this.optionsTableName} (\`contentslot_id\`, \`name\`, \`value\`) VALUES (?,?,?)`,
        [id, key, value]
      )
      optionsChanged = true
    }

    return optionsChanged
  }

  /**
   * @param {Object} row
   *
   * @return {{componentType: String, columnEnd: Number, viewId: Number, columnStart: Number, rowStart: Number, rowEnd: Number, id: Number, options: Object}}
   */
  rowToObject (row) {
    return {
      id: row.id,
      componentType: row.component_type,
      viewId: row.view_id,
      columnStart: row.column_start,
      rowStart: row.row_start,
      columnEnd: row.column_end,
      rowEnd: row.row_end,
      options: {}
    }
  }

  /**
   * @param {Object} row
   * @param {Map<String,String>} options
   *
   * @return {{componentType: String, columnEnd: Number, viewId: Number, columnStart: Number, rowStart: Number, rowEnd: Number, id: Number, options: Object}}
   */
  rowToObjectWithOptions (row, options) {
    const object = this.rowToObject(row)
    options.forEach((value, key) => {
      object.options[key] = value
    })
    return object
  }

  /**
   * @param {Number} id
   * @param {String} componentType
   * @param {Number} viewId
   * @param {Number} columnStart
   * @param {Number} rowStart
   * @param {Number} columnEnd
   * @param {Number} rowEnd
   * @param {Object} options
   *
   * @return {Promise<Number>|Promise<null>}
   */
  async updateContentSlot (id, componentType, viewId, columnStart, rowStart, columnEnd, rowEnd, options) {
    let conn
    try {
      conn = await this.connectionPool.getConnection()
      const result = await conn.query(
        `UPDATE ${this.tableName} SET \`view_id\` = ?, \`component_type\` = ?, \`column_start\` = ?, \`row_start\` = ?, \`column_end\` = ?, \`row_end\` = ? WHERE \`id\` = ?`,
        [viewId, componentType, columnStart, rowStart, columnEnd, rowEnd, id]
      )
      const contentSlotChanged = result.affectedRows === 1
      const optionsChanged = await this.setOptionsForContentSlot(conn, id, options)
      return (contentSlotChanged || optionsChanged) ? id : null
    } finally {
      if (conn) {
        conn.release()
      }
    }
  }
}

module.exports = ContentSlotRepository
