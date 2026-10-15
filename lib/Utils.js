import { BufferGeometry } from "three";
import { mergeGeometries as mergeGeometriesImpl } from "three/examples/jsm/utils/BufferGeometryUtils.js";
const defined = require("./defined");

/**
 * 只保留几何体的position属性，移除所有非position属性
 * @param {BufferGeometry[]} geometries
 */
function keepOnlyPositionAttribute(geometries) {
    if (geometries.length <= 1) return;

    // 如果几何体具有索引，则转换为非索引几何体
    for (let i = 0; i < geometries.length; i++) {
        const geometry = geometries[i];
        if (defined(geometry.index))
            geometries[i] = geometry.toNonIndexed();
    }
    // 移除非position属性
    geometries.forEach(geometry => {
        for (const attrName in geometry.attributes) {
            if (attrName !== 'position') {
                geometry.deleteAttribute(attrName);
            }
        }
    });
    // 若存在已为非索引的几何体，mergeGeometries要求索引状态一致：统一转非索引
    if (geometries.some(geometry => !defined(geometry.index))) {
        for (let i = 0; i < geometries.length; i++) {
            const geometry = geometries[i];
            if (defined(geometry.index))
                geometries[i] = geometry.toNonIndexed();
        }
    }
};
/**
 * 标准化几何体属性，移除所有非position、normal、uv属性，
 * 并统一各几何体的属性集合，使其满足mergeGeometries的兼容性前置条件。
 *
 * mergeGeometries要求同批几何体的属性集合完全一致（以首个几何体为准），
 * 集合不一致时返回null。输入模型常出现同材质下网格属性不齐
 * （如车道标线网格无uv、相邻网格有uv），必须先取交集对齐，否则合并失败。
 * @param {BufferGeometry[]} geometries
*/
function normalizeGeometryAttributes(geometries) {
    if (geometries.length <= 1) return;

    // 如果几何体具有索引，则转换为非索引几何体
    for (let i = 0; i < geometries.length; i++) {
        const geometry = geometries[i];
        if (defined(geometry.index))
            geometries[i] = geometry.toNonIndexed();
    }

    // 1.取各几何体属性名的交集，保证合并批次内属性集合一致
    let common = null;
    geometries.forEach(geometry => {
        const names = new Set(Object.keys(geometry.attributes));
        common = common === null ? names : new Set([...common].filter(name => names.has(name)));
    });
    if (common === null) return;

    // 2.删除非白名单属性，以及未出现在交集内的属性（属性集合不一致的根因）
    geometries.forEach(geometry => {
        for (const attrName in geometry.attributes) {
            if (!common.has(attrName)) {
                console.log(`删除几何体${geometry.uuid}的属性${attrName}。`);
                geometry.deleteAttribute(attrName);
            }
        }
    });
};
/**
 * 合并几何体
 * @param {BufferGeometry[]} geometries
 * @param {boolean} onlyPosition 是否只保留position属性
 * @returns {BufferGeometry}
 */
function mergeGeometries(geometries, onlyPosition = false) {
    if (geometries.length <= 1) return geometries[0];
    if (onlyPosition) keepOnlyPositionAttribute(geometries);
    else normalizeGeometryAttributes(geometries);
    const result = mergeGeometriesImpl(geometries);
    // mergeGeometries在属性不兼容时返回null，此处明确抛出，
    // 避免以"Cannot set properties of null"的形式抛出难以定位的错误
    if (result === null) {
        throw new Error(
            "mergeGeometries合并失败：同批次几何体属性不兼容（position/normal/uv集合或index状态不一致），" +
            "几何体数量=" + geometries.length +
            "，属性集合=" + JSON.stringify(geometries.map(g => Object.keys(g.attributes).sort().join('+')))
        );
    }
    result.isMerged = true; //标记为合并几何体
    return result;
};

module.exports = { normalizeGeometryAttributes, keepOnlyPositionAttribute, mergeGeometries };