/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * @author Ruby RK
 * @version 0.1
 *
 * @module N/format
 * @module N/record
 * @module N/runtime
 * @module N/search
 * @module N/ui/serverWidget
 *
 * @description
 */
define(['N/format', 'N/record', 'N/runtime', 'N/search', 'N/ui/serverWidget'],
    (format, record, runtime, search, serverWidget) => {
    const AUTOTRADER_SUBSIDIARY_ID = 118;
    const STEPS = {
        1: {
         id: 'selection',
         label: 'Date Range'
        },
        2: {
            id: 'list',
            label: 'List of Invoices'
        },
        3: {
            id: 'review',
            label: 'Review Your Update'
        }
    };

    function onRequest(context) {
        let ivPoUpdateAssistant = serverWidget.createAssistant({
           title: 'Update Memo # on Invoices'
        });

        for (let s in STEPS) {
            ivPoUpdateAssistant.addStep({
                id: STEPS[s].id,
                label: STEPS[s].label
            });
        }

        let sHttp = [];

        sHttp['GET'] = (context) => {
            let step;
            let today = new Date();
            if (!ivPoUpdateAssistant.currentStep) {
                ivPoUpdateAssistant.currentStep = ivPoUpdateAssistant.getStep({
                    id: STEPS[1].id
                });
            }

            step = ivPoUpdateAssistant.currentStep.id;

            switch(step) {
                case STEPS[1].id:
                    let startDateField = ivPoUpdateAssistant.addField({
                        id: 'iv_po_start_date',
                        label: 'Start Date',
                        type: serverWidget.FieldType.DATE
                    });
                    startDateField.defaultValue = format.format({
                        value: new Date(today.getFullYear(), today.getMonth() -1 , today.getDate()),
                        type: format.Type.DATE
                    });

                    let endDateField = ivPoUpdateAssistant.addField({
                        id: 'iv_po_end_date',
                        label: 'End Date',
                        type: serverWidget.FieldType.DATE
                    });
                    endDateField.defaultValue = format.format({
                        value: today,
                        type: format.Type.DATE
                    });
                    break;
                case STEPS[2].id:
                    let step1 = ivPoUpdateAssistant.getStep({
                        id: STEPS[1].id
                    });
                    let startDate = step1.getValue({
                        id: 'iv_po_start_date'
                    });
                    let endDate = step1.getValue({
                        id: 'iv_po_end_date'
                    });
                    let invoices = getInvoices(startDate, endDate);

                    let invoiceSublist = ivPoUpdateAssistant.addSublist({
                        id: 'iv_po_sublist',
                        label: 'Invoices to be Updated',
                        type: serverWidget.SublistType.INLINEEDITOR
                    });
                    invoiceSublist.addField({
                        id: 'iv_po_sublist_internalid',
                        label: 'Internal ID',
                        type: serverWidget.FieldType.TEXT
                    }).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                    invoiceSublist.addField({
                        id: 'iv_po_sublist_trandate',
                        label: 'Transaction Date',
                        type: serverWidget.FieldType.TEXT
                    }).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                    invoiceSublist.addField({
                        id: 'iv_po_sublist_entityname',
                        label: 'Customer',
                        type: serverWidget.FieldType.TEXT
                    }).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                    invoiceSublist.addField({
                        id: 'iv_po_sublist_tranid',
                        label: 'Transaction ID',
                        type: serverWidget.FieldType.TEXT
                    }).updateDisplayType({displayType: serverWidget.FieldDisplayType.DISABLED});
                    invoiceSublist.addField({
                        id: 'iv_po_sublist_ponum',
                        label: 'Memo #',
                        type: serverWidget.FieldType.TEXT
                    });

                    let lineId = 0;
                    for (let i in invoices) {
                        invoiceSublist.setSublistValue({
                            id: 'iv_po_sublist_internalid',
                            line: lineId,
                            value: invoices[i].internalId
                        });
                        invoiceSublist.setSublistValue({
                            id: 'iv_po_sublist_trandate',
                            line: lineId,
                            value: invoices[i].tranDate
                        });
                        invoiceSublist.setSublistValue({
                            id: 'iv_po_sublist_entityname',
                            line: lineId,
                            value: invoices[i].entityName
                        });
                        invoiceSublist.setSublistValue({
                            id: 'iv_po_sublist_tranid',
                            line: lineId,
                            value: invoices[i].tranId
                        });

                        lineId++;
                    }

                    break;
                case STEPS[3].id:
                    let infoField = ivPoUpdateAssistant.addField({
                        id: 'iv_po_final_info',
                        label: 'Are you ready to submit all data?',
                        type: serverWidget.FieldType.INLINEHTML
                    });
                    infoField.defaultValue = '<b>Are you ready to submit all data?</b><br><br>' +
                        'Clicking Final button will automatically update the Invoices where PO Number is entered<br>' +
                        'Please make sure you don\'t have more than 50 invoices to be updated.';
                    break;
            }
            context.response.writePage({
                pageObject: ivPoUpdateAssistant
            });
        }

        sHttp['POST'] = (context) => {
            if (ivPoUpdateAssistant.getLastAction() === serverWidget.AssistantSubmitAction.NEXT || ivPoUpdateAssistant.getLastAction() === serverWidget.AssistantSubmitAction.BACK) {
                ivPoUpdateAssistant.currentStep = ivPoUpdateAssistant.getNextStep();
            } else if (ivPoUpdateAssistant.getLastAction() === serverWidget.AssistantSubmitAction.FINISH) {
                let step2 = ivPoUpdateAssistant.getStep({
                    id: STEPS[2].id
                });
                let invoiceSublistLineCount = step2.getLineCount({
                    group: 'iv_po_sublist'
                });
                for (let i = 0; i < invoiceSublistLineCount; i++) {
                    let invoiceId = step2.getSublistValue({
                        group: 'iv_po_sublist',
                        line: i,
                        id: 'iv_po_sublist_internalid'
                    });
                    let poNum = step2.getSublistValue({
                        group: 'iv_po_sublist',
                        line: i,
                        id: 'iv_po_sublist_ponum'
                    });

                    /*if (!isEmpty(poNum))
                        record.submitFields({
                            type: record.Type.INVOICE,
                            id: invoiceId,
                            values: {
                                memo: poNum
                            }
                        });*/
                }

                ivPoUpdateAssistant.finishedHtml = 'Invoices have been updated.<br><br>';
            }
            ivPoUpdateAssistant.sendRedirect({
                response: context.response
            });
        }

        sHttp[context.request.method](context);
    }

    let getInvoices = (startDate, endDate) => {
        let returnData = [];
        let invoiceSearch = search.create({
            type: search.Type.INVOICE,
            filters: [
                ['mainline', search.Operator.IS, true], 'AND',
                ['subsidiary', search.Operator.ANYOF, AUTOTRADER_SUBSIDIARY_ID], 'AND',
                ['trandate', search.Operator.WITHIN, startDate, endDate], 'AND',
                ['otherrefnum', search.Operator.ISEMPTY, ''], 'AND',
                ['customer.custentity_olx_aut_cu_ponumber', search.Operator.IS, true]
            ],
            columns: ['trandate', 'tranid', 'entity']
        });

        invoiceSearch.run().each((result) => {
            let invoiceData = {};
            invoiceData.internalId = result.id;
            invoiceData.tranDate = result.getValue({
                name: 'trandate'
            });
            invoiceData.entityName = result.getText({
                name: 'entity'
            });
            invoiceData.tranId = result.getValue({
                name: 'tranid'
            });

            returnData.push(invoiceData);
            return true;
        });

        return returnData;
    }

    function isEmpty(value) {
        if (value === undefined || value === null)
            return true;
        if (util.isNumber(value) || util.isBoolean(value) || util.isDate(value) || util.isFunction(value))
            return false;
        if (util.isString(value))
            return (value.length === 0);
        return (Object.keys(value).length === 0);
    }

    return {
        onRequest: onRequest
    };
    
});