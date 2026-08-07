import { prisma } from "@/lib/prisma";

export const entityQueries = {
    /* ==========================
    Entity
    ========================== */
    async getEntityMetadata(entity: number) {
        // 1. Fetch the base entity
        const entityObj = await prisma.entity_obj.findUnique({
            where: { OBJ_ID: entity }
        });

        if (!entityObj) return null;

        // 2. Fetch attributes belonging to this entity
        //    (linked via OBJ_TYP + OBJ_NM, not a numeric FK)
        const attrbts = await prisma.entity_obj_attrbt.findMany({
            where: {
                OBJ_TYP: entityObj.OBJ_TYP,
                OBJ_NM: entityObj.OBJ_NM,
                IS_DELETED: 0
            }
        });

        const attrbtIds = attrbts.map(a => a.OBJ_ATTRBT_ID);
        const attrbtNms = attrbts.map(a => a.OBJ_ATTRBT_NM);

        // 3. Fetch everything else in parallel
        const [
            dsplyDtl,
            dependentData,
            attrbtMppng,
            objMppng,
            previleges
        ] = await Promise.all([
            // Has a direct OBJ_ATTRBT_ID column -> simple `in` filter
            prisma.entity_obj_attrbt_dsply_dtl.findMany({
                where: {
                    OBJ_ATTRBT_ID: { in: attrbtIds },
                    IS_DELETED: 0
                }
            }),

            // No FK column at all -> match on the same business key
            // (OBJ_TYP + OBJ_NM + OBJ_ATTRBT_NM)
            prisma.entity_obj_attrbt_dependent_data.findMany({
                where: {
                    OBJ_TYP: entityObj.OBJ_TYP,
                    OBJ_NM: entityObj.OBJ_NM,
                    OBJ_ATTRBT_NM: { in: attrbtNms },
                    IS_DELETED: 0
                }
            }),

            // Matches on SRC_OBJ_NM + SRC_OBJ_ATTRBT_NM
            prisma.entity_obj_attrbt_mppng.findMany({
                where: {
                    SRC_OBJ_NM: entityObj.OBJ_NM,
                    SRC_OBJ_ATTRBT_NM: { in: attrbtNms },
                    IS_DELETED: 0
                },
                include: {
                    entity_obj_mppng_via_OBJ_MPPNG_ID: true // this relation IS defined, so keep it
                }
            }),

            // entity_obj_mppng links via numeric SRC_OBJ_ID / TRGT_OBJ_ID
            prisma.entity_obj_mppng.findMany({
                where: {
                    OR: [
                        { SRC_OBJ_ID: entity },
                        { TRGT_OBJ_ID: entity }
                    ],
                    IS_DELETED: 0
                }
            }),

            // Has real OBJ_ID and OBJ_ATTRBT_ID columns -> simple filter
            prisma.obj_attrbt_previleges.findMany({
                where: {
                    OBJ_ID: entity,
                    OBJ_ATTRBT_ID: { in: attrbtIds },
                    IS_DELETED: 0
                }
            })
        ]);

        // 4. Group children by their matching key for O(1) lookup
        const groupBy = <T extends Record<string, any>>(arr: T[], keyFn: (item: T) => string) =>
            arr.reduce((acc, item) => {
                const key = keyFn(item);
                (acc[key] ??= []).push(item);
                return acc;
            }, {} as Record<string, T[]>);

        const dsplyDtlById        = groupBy(dsplyDtl, i => String(i.OBJ_ATTRBT_ID));
        const dependentDataByNm   = groupBy(dependentData, i => i.OBJ_ATTRBT_NM);
        const attrbtMppngByNm     = groupBy(attrbtMppng, i => i.SRC_OBJ_ATTRBT_NM);
        const previlegesById      = groupBy(previleges, i => String(i.OBJ_ATTRBT_ID));

        // 5. Assemble final shape
        const enrichedAttrbts = attrbts.map(attrbt => ({
            ...attrbt,
            entity_obj_attrbt_dsply_dtl: dsplyDtlById[String(attrbt.OBJ_ATTRBT_ID)] ?? [],
            entity_obj_attrbt_dependent_data: dependentDataByNm[attrbt.OBJ_ATTRBT_NM] ?? [],
            entity_obj_attrbt_mppng: attrbtMppngByNm[attrbt.OBJ_ATTRBT_NM] ?? [],
            obj_attrbt_previleges: previlegesById[String(attrbt.OBJ_ATTRBT_ID)] ?? []
        }));

        return {
            ...entityObj,
            entity_obj_attrbt: enrichedAttrbts,
            entity_obj_mppng: objMppng
        };
    },
    getEntityObjects() {
        return prisma.entity_obj.findMany();
    },
    getEntityList(filters?: any) {
        return prisma.entity_obj.findMany(filters);
    },
    getEntity(id: number) {
        return prisma.entity_obj.findUnique({
            where: { OBJ_ID:id }
        });
    },
    createEntity(data: any) {
        return prisma.entity_obj.create({
            data
        });
    },
    updateEntity(id: number, data: any) {
        return prisma.entity_obj.update({
            where: { OBJ_ID:id },
            data
        });
    },
    saveEntity(data: any) {
        return prisma.entity_obj.upsert({
            where: { OBJ_ID:data.OBJ_ID },
            update: data,
            create: data
        });
    },
    deleteEntity(id: number) {
        return prisma.entity_obj.delete({
            where: { OBJ_ID:id }
        });
    },
    /* ==========================
    Entity Attributes
    ========================== */
    getEntityAttributes(entityId: number) {
        return prisma.entity_obj_attrbt.findMany({
            where: {
                OBJ_ATTRBT_ID: entityId
            }
        });
    },
    getAttribute(attributeId: number) {
        return prisma.entity_obj_attrbt.findUnique({
            where: { OBJ_ATTRBT_ID:attributeId }
        });
    },
    createAttribute(data: any) {
        return prisma.entity_obj_attrbt.create({
            data
        });
    },
    saveAttribute(data: any) {
        return prisma.entity_obj_attrbt.upsert({
            where: { OBJ_ATTRBT_ID:data.OBJ_ATTRBT_ID },
            update: data,
            create: data
        });
    },
    updateAttribute(attributeId: number, data: any) {
        return prisma.entity_obj_attrbt.update({
            where: { OBJ_ATTRBT_ID:attributeId },
            data
        });
    },
    deleteAttribute(attributeId: number) {
        return prisma.entity_obj_attrbt.delete({
            where: { OBJ_ATTRBT_ID:attributeId }
        });
    },
    /* ==========================
    Display Details
    ========================== */
    getDisplayDetails(attributeId: number) {
        return prisma.entity_obj_attrbt_dsply_dtl.findMany({
            where: {
                OBJ_ATTRBT_DSPLY_ID: attributeId
            }
        });
    },
    getDisplayDetail(attributeId: number) {
        return prisma.entity_obj_attrbt_dsply_dtl.findUnique({
            where: { OBJ_ATTRBT_DSPLY_ID:attributeId }
        });
    },
    createDisplayDetail(data: any) {
        return prisma.entity_obj_attrbt_dsply_dtl.create({
            data
        });
    },
    updateDisplayDetail(attributeId: number, data: any) {
        return prisma.entity_obj_attrbt_dsply_dtl.update({
            where: { OBJ_ATTRBT_DSPLY_ID:attributeId },
            data
        });
    },
    saveDisplayDetails(data: any) {
        return prisma.entity_obj_attrbt_dsply_dtl.upsert({
            where: { OBJ_ATTRBT_DSPLY_ID:data.OBJ_ATTRBT_DSPLY_ID },
            update: data,
            create: data
        });
    },
    deleteDisplayDetail(attributeId: number) {
        return prisma.entity_obj_attrbt_dsply_dtl.delete({
            where: { OBJ_ATTRBT_DSPLY_ID:attributeId }
        });
    },
    /* ==========================
    Dependent Data
    ========================== */   
    getDependentData(attributeId: number) {
        return prisma.entity_obj_attrbt_dependent_data.findMany({
            where: {
                OBJ_ATTRBT_ID: attributeId
            }
        });
    },
    saveDependentData(data: any) {
        return prisma.entity_obj_attrbt_dependent_data.upsert({
            where: { OBJ_ATTRBT_ID:data.OBJ_ATTRBT_ID },
            update: data,
            create: data
        });
    },
    deleteDependentData(attributeId: number) {
        return prisma.entity_obj_attrbt_dependent_data.delete({
            where: { OBJ_ATTRBT_ID:attributeId }
        });
    },
    /* ==========================
    Attribute Mappings
    ========================== */
    getAttributeMappings(attributeId: number) {
        return prisma.entity_obj_attrbt_mppng.findMany({
            where: {
                OBJ_ATTRBT_MPPNG_ID: attributeId
            }
        });
    },
    getAttributeMapping(attributeId: number) {
        return prisma.entity_obj_attrbt_mppng.findUnique({
            where: { OBJ_ATTRBT_MPPNG_ID:attributeId }
        });
    },
    createAttributeMapping(data: any) {
        return prisma.entity_obj_attrbt_mppng.create({
            data
        });
    },
    updateAttributeMapping(attributeId: number, data: any) {
        return prisma.entity_obj_attrbt_mppng.update({
            where: { OBJ_ATTRBT_MPPNG_ID:attributeId },
            data
        });
    },
    saveAttributeMapping(data: any) {
        return prisma.entity_obj_attrbt_mppng.upsert({
            where: { OBJ_ATTRBT_MPPNG_ID:data.OBJ_ATTRBT_MPPNG_ID },
            update: data,
            create: data
        });
    },
    deleteAttributeMapping(attributeId: number) {
        return prisma.entity_obj_attrbt_mppng.delete({
            where: { OBJ_ATTRBT_MPPNG_ID:attributeId }
        });
    },
    /* ==========================
    Entity Mappings
    ========================== */
    getEntityMappings(entityId: number) {
        return prisma.entity_obj_mppng.findMany({
            where: {
                OBJ_MPPNG_ID: entityId
            }
        });
    },
    getEntityMapping(entityId: number) {
        return prisma.entity_obj_mppng.findUnique({
            where: { OBJ_MPPNG_ID:entityId }
        });
    },
    createEntityMapping(data: any) {
        return prisma.entity_obj_mppng.create({
            data
        });
    },
    updateEntityMapping(entityId: number, data: any) {
        return prisma.entity_obj_mppng.update({
            where: { OBJ_MPPNG_ID:entityId },
            data
        });
    },
    saveEntityMapping(data: any) {
        return prisma.entity_obj_mppng.upsert({
            where: { OBJ_MPPNG_ID:data.OBJ_MPPNG_ID },
            update: data,
            create: data
        });
    },
    deleteEntityMapping(entityId: number) {
        return prisma.entity_obj_mppng.delete({
            where: { OBJ_MPPNG_ID:entityId }
        });
    },
    /* ==========================
    Privileges
    ========================== */
    getPrivileges(attributeId: number) {
        return prisma.obj_attrbt_previleges.findMany({
            where: {
                OBJ_ATTRBT_PREVILEGES_ID: attributeId
            }
        });
    },
    getPrivilege(attributeId: number) {
        return prisma.obj_attrbt_previleges.findUnique({
            where: { OBJ_ATTRBT_PREVILEGES_ID:attributeId }
        });
    },
    createPrivilege(data: any) {
        return prisma.obj_attrbt_previleges.create({
            data
        });
    },
    updatePrivilege(attributeId: number, data: any) {
        return prisma.obj_attrbt_previleges.update({
            where: { OBJ_ATTRBT_PREVILEGES_ID:attributeId },
            data
        });
    },
    savePrivileges(data: any) {
        return prisma.obj_attrbt_previleges.upsert({
            where: { OBJ_ATTRBT_PREVILEGES_ID:data.OBJ_ATTRBT_PREVILEGES_ID },
            update: data,
            create: data
        });
    },
    deletePrivilege(attributeId: number) {
        return prisma.obj_attrbt_previleges.delete({
            where: { OBJ_ATTRBT_PREVILEGES_ID:attributeId }
        });
    },
    /* ==========================
    Temporary Entities
    ========================== */
    getTemporaryEntities() {
        return prisma.entity_obj_tmp.findMany();
    },
    getTemporaryEntity(id: number) {
        return prisma.entity_obj_tmp.findUnique({
            where: { TMP_OBJ_ID:id }
        });
    },
    createTemporaryEntity(data: any) {
        return prisma.entity_obj_tmp.create({
            data
        });
    },
    updateTemporaryEntity(id: number, data: any) {
        return prisma.entity_obj_tmp.update({
            where: { TMP_OBJ_ID:id },
            data
        });
    },
    saveTemporaryEntity(data: any) {
        return prisma.entity_obj_tmp.upsert({
            where: { TMP_OBJ_ID:data.TMP_OBJ_ID },
            update: data,
            create: data
        });
    },
    deleteTemporaryEntity(id: number) {
        return prisma.entity_obj_tmp.delete({
            where: { TMP_OBJ_ID:id }
        });
    },
};