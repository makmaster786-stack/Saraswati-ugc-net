document.addEventListener('DOMContentLoaded', () => {
    const input=document.getElementById('question-excel'), preview=document.getElementById('excel-preview'), save=document.getElementById('excel-import'), message=document.getElementById('excel-message'), rows=document.getElementById('excel-rows');
    let validatedFile=null;
    input.addEventListener('change',()=>{validatedFile=null;save.disabled=true;rows.replaceChildren();message.textContent='';});
    async function send(action){
        const file=input.files[0];
        if(!file){message.textContent='Choose a completed Excel workbook first.';return;}
        if(action==='import' && file!==validatedFile)return;
        input.disabled=true;preview.disabled=true;save.disabled=true;message.textContent=action==='import'?'Importing questions…':'Checking workbook…';
        try {
            const form=new FormData();form.append('file',file);form.append('action',action);
            const id=new URLSearchParams(location.search).get('id');
            const response=await fetch(`/api/admin/tests/${encodeURIComponent(id)}/questions/excel`,{method:'POST',body:form});
            const data=await response.json();
            if(!response.ok)throw new Error(data.errors?.join('\n')||data.message||'Import failed. Please sign in again if your session expired.');
            rows.replaceChildren();
            if(action==='import'){message.textContent=data.message;validatedFile=null;input.value='';const link=document.createElement('a');link.href=location.href;link.textContent='Refresh to see updated questions';rows.append(link);return;}
            validatedFile=file;message.textContent=`${data.count} valid questions. Review below, then click Import into this test.`;
            data.preview.forEach(row=>{
                const details=document.createElement('details'), summary=document.createElement('summary');summary.textContent=`Row ${row.row}: ${row.values[0]}`;details.append(summary);
                const content=document.createElement('pre');content.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font:inherit;padding:12px;';
                content.textContent=[row.values[1],...['A','B','C','D'].map((label,i)=>`${label}: ${row.values[2+i*2]} / ${row.values[3+i*2]}`),`Correct: ${row.values[10]}`,`Explanation:\n${row.values[11]}`,`${row.values[12]} · ${row.values[13]}`].join('\n\n');details.append(content);rows.append(details);
            });
        } catch(e){validatedFile=null;message.textContent=e.message;}
        finally{input.disabled=false;preview.disabled=false;save.disabled=!validatedFile;}
    }
    preview.addEventListener('click',()=>send('preview'));
    save.addEventListener('click',()=>send('import'));
});
