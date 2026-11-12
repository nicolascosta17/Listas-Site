import React,{useEffect,useMemo,useRef,useState} from 'react';
import {
  LayoutDashboard,ListChecks,Plus,Search,Check,Clock3,MoreHorizontal,
  FileText,Download,Upload,Copy,Settings2,LogOut,Menu,PanelLeftClose,
  PanelLeftOpen,X,Save,RotateCcw,Trash2,Edit3,CalendarDays,FileBarChart2,
  ChevronLeft,ChevronRight,ChevronDown,ShieldCheck,AlertTriangle,Cloud,
  CloudOff,CheckCircle2,Building2,CheckSquare,SlidersHorizontal,
  Filter,Palette,ArchiveRestore,History,LockKeyhole,Eye,EyeOff,
  ArrowRight,Printer,ClipboardCopy,Info,Hash,GripVertical,ChevronUp,
  Sparkles,PlusCircle,FolderPlus
} from 'lucide-react';
import {sb} from './supabase.js';
import {
  clone,makeId,activeList,periodOf,periodView,ensureActive,syncActive,prepareData,
  blankList,addCompany,periodKey,safeType,taskDone,companyStatus,counter,
  viewCompanies,purgeEntries,templateFrom,validateTemplate,applyTemplate,
  downloadFile,filename,reportMonth,reportWeek,startOfWeek
} from './model.js';

const palettes=[
  {label:'Bordô',value:'#773d58'},
  {label:'Azul',value:'#3974bd'},
  {label:'Esmeralda',value:'#168b79'},
  {label:'Violeta',value:'#7859bd'},
  {label:'Terracota',value:'#b3644d'},
  {label:'Dourado',value:'#a37d39'},
  {label:'Grafite',value:'#475569'},
  {label:'Rosa',value:'#c45c83'}
];
const today=new Date();
const dateLabel=d=>new Date(d).toLocaleDateString('pt-BR',{day:'2-digit',month:'short',year:'numeric'});
const dateTime=d=>new Date(d).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
function Button({children,icon:Icon,variant='subtle',className='',...props}) {
  return <button type="button" className={'btn btn-'+variant+' '+className} {...props}>
    {Icon&&<Icon size={16} strokeWidth={1.9}/>}<span>{children}</span>
  </button>;
}
function Modal({title,onClose,children,actions,wide=false}) {
  useEffect(()=>{
    const handler=e=>{if(e.key==='Escape')onClose();};
    window.addEventListener('keydown',handler);
    return ()=>window.removeEventListener('keydown',handler);
  },[onClose]);
  return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className={'dialog '+(wide?'dialog-wide':'')} role="dialog" aria-modal="true" aria-label={title}>
      <div className="dialog-header"><div><h2>{title}</h2></div>
        <button className="icon-button" title="Fechar" aria-label="Fechar" onClick={onClose}><X size={20}/></button></div>
      <div className="dialog-body">{children}</div>
      {actions&&<div className="dialog-actions">{actions}</div>}
    </section>
  </div>;
}
function Toast({toast,onClose}) {
  useEffect(()=>{if(!toast)return;const t=setTimeout(onClose,5200);return()=>clearTimeout(t);},[toast,onClose]);
  if(!toast)return null;
  return <div className={'toast '+(toast.error?'toast-error':'')} role="status">
    {toast.error?<AlertTriangle size={19}/>:<CheckCircle2 size={19}/>}
    <span>{toast.text}</span><button aria-label="Fechar aviso" onClick={onClose}><X size={16}/></button>
  </div>;
}
function AuthScreen({onReady}) {
  const [mode,setMode]=useState('login'),[email,setEmail]=useState(''),
    [password,setPassword]=useState(''),[visible,setVisible]=useState(false),
    [message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  async function submit(e) {
    e.preventDefault();setBusy(true);setMessage('');
    const credentials={email:email.trim(),password};
    const result=mode==='login'
      ?await sb.auth.signInWithPassword(credentials)
      :await sb.auth.signUp(credentials);
    setBusy(false);
    if(result.error){setMessage(result.error.message==='Invalid login credentials'?'E-mail ou senha incorretos.':result.error.message);return;}
    if(!result.data.session){setMessage('Conta criada. Confira seu e-mail para confirmar o cadastro.');return;}
    onReady(result.data.session.user);
  }
  return <div className="auth-page">
    <div className="auth-art"><div className="auth-mark"><ListChecks size={30}/></div>
      <div className="auth-display"><div className="eyebrow">ORGANIZAÇÃO INTELIGENTE</div>
        <h1>Seu trabalho,<br/><em>sob controle.</em></h1>
        <p>Listas organizadas, empresas reunidas e cada entrega acompanhada em um só lugar.</p>
        <div className="auth-features"><span><Check size={16}/>Competências independentes</span>
          <span><Check size={16}/>Salvamento no Supabase</span>
          <span><Check size={16}/>Relatórios completos</span></div></div>
      <div className="auth-art-footer">CONTIDADOS <span>•</span> Minhas Listas</div>
    </div>
    <div className="auth-panel"><div className="mobile-brand"><ListChecks size={25}/> MINHAS LISTAS</div>
      <form className="auth-card" onSubmit={submit}>
        <span className="mini-label">BEM-VINDO(A) DE VOLTA</span>
        <h2>{mode==='login'?'Acesse sua conta':'Criar sua conta'}</h2>
        <p>{mode==='login'?'Continue de onde parou, com seus dados sempre salvos.':'Comece a organizar suas rotinas em poucos passos.'}</p>
        <label>E-mail<input type="email" autoComplete="email" required value={email}
          onChange={e=>setEmail(e.target.value)} placeholder="seuemail@empresa.com"/></label>
        <label>Senha<div className="password-input"><input type={visible?'text':'password'} minLength={6}
          autoComplete={mode==='login'?'current-password':'new-password'} required value={password}
          onChange={e=>setPassword(e.target.value)} placeholder="Sua senha"/>
          <button type="button" onClick={()=>setVisible(!visible)} aria-label="Mostrar senha">
            {visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>
        {message&&<div className="auth-message">{message}</div>}
        <button className="auth-submit" type="submit" disabled={busy}>
          {busy?'Acessando…':mode==='login'?'Entrar na plataforma':'Criar conta'}<ArrowRight size={18}/>
        </button>
        <div className="auth-toggle">{mode==='login'?'Ainda não tem uma conta?':'Já tem cadastro?'}
          <button type="button" onClick={()=>{setMode(mode==='login'?'register':'login');setMessage('');}}>
            {mode==='login'?'Cadastre-se':'Fazer login'}</button></div>
      </form>
      <div className="auth-bottom"><ShieldCheck size={17}/> Seus dados protegidos com autenticação Supabase</div>
    </div>
  </div>;
}
function EditableCell({value,onChange,onBlur,className='',type='text',placeholder='',title}) {
  const [draft,setDraft]=useState(String(value??''));
  useEffect(()=>setDraft(String(value??'')),[value]);
  return <input className={className||'table-edit'} type={type}
    value={draft} placeholder={placeholder} title={title}
    onChange={e=>{setDraft(e.target.value);onChange(e.target.value);}}
    onBlur={()=>onBlur?.(draft)} />;
}
function TransferDialog({state,current,onClose,onApply,onToast}) {
  const active=activeList(state),p=periodOf(state,active);
  const sources=state.lists.flatMap(l=>(l.periods||[])
    .filter(period=>l.id!==active.id||period.id!==p.id)
    .map(period=>({list:l,period,view:periodView(l,period.id)})));
  const [mode,setMode]=useState('copy'),[index,setIndex]=useState(0),
    [fileData,setFileData]=useState(null),[confirmed,setConfirmed]=useState(false);
  const item=sources[index];
  const proposed=mode==='copy'&&item?templateFrom(state,item.list,item.period.id):fileData;
  const inputRef=useRef();
  async function readFile(file) {
    if(!file)return;
    if(file.size>10*1024*1024){onToast('Arquivo maior que 10 MB.',true);return;}
    try{
      const json=JSON.parse(await file.text());validateTemplate(json);
      setFileData(json);setConfirmed(false);
    }catch(e){setFileData(null);onToast(e.message,true);}
  }
  function exportCurrent(){
    try{
      const obj=templateFrom(state,active,p.id);validateTemplate(obj);
      downloadFile('modelo-'+filename(active.name+'-'+p.name)+'.json',
        JSON.stringify(obj,null,2),'application/json;charset=utf-8');
      onToast('Modelo exportado sem checkpoints concluídos.');
    }catch(e){onToast(e.message,true);}
  }
  function doApply(){
    if(!confirmed||!proposed)return;
    try {onApply(proposed);onClose();}catch(e){onToast(e.message,true);}
  }
  return <Modal title="Transferir dados entre listas" onClose={onClose} wide>
    <div className="tab-control">
      <button className={mode==='copy'?'active':''} onClick={()=>{setMode('copy');setConfirmed(false)}}><Copy size={16}/>Copiar mês</button>
      <button className={mode==='export'?'active':''} onClick={()=>setMode('export')}><Download size={16}/>Exportar</button>
      <button className={mode==='import'?'active':''} onClick={()=>{setMode('import');setConfirmed(false)}}><Upload size={16}/>Importar</button>
    </div>
    <div className="transfer-content">
      {mode==='copy'&&<><p className="muted">Copie toda a estrutura de uma competência, sem levar as caixas marcadas como concluídas.</p>
        <label className="field-label">Copiar de</label>
        <select className="input" value={index} onChange={e=>{setIndex(Number(e.target.value));setConfirmed(false)}}>
          {sources.map((s,i)=><option key={s.list.id+s.period.id} value={i}>{s.list.name} / {s.period.name} • {s.view.companies.length} empresas</option>)}</select>
        {!sources.length&&<p className="hint">Não há outro mês ou lista disponível.</p>}</>}
      {mode==='export'&&<><div className="feature-card"><Download size={27}/><div>
          <b>Baixar modelo completo</b><p>Empresas, numeração, observações, etapas, campos preenchidos e configurações em JSON.</p>
        </div></div><p className="hint"><Info size={15}/> O modelo não inclui checkpoints concluídos.</p>
        <Button variant="primary" icon={Download} onClick={exportCurrent}>Baixar arquivo JSON</Button></>}
      {mode==='import'&&<><div className="feature-card"><Upload size={27}/><div>
          <b>Importar arquivo de modelo</b><p>Selecione um JSON exportado pelo Minhas Listas.</p>
        </div></div>
        <input ref={inputRef} type="file" accept=".json,application/json" style={{display:'none'}}
          onChange={e=>readFile(e.target.files?.[0])}/>
        <Button icon={Upload} onClick={()=>inputRef.current?.click()}>Selecionar arquivo</Button>
        {fileData&&<p className="success-line"><Check size={17}/> Arquivo válido: {fileData.empresas.length} empresas, {fileData.etapas.length} etapas</p>}</>}
      {(mode==='copy'||mode==='import')&&proposed&&<>
        <div className="transfer-summary">
          <span>Destino: <b>{active.name} / {p.name}</b></span>
          <div><b>{proposed.empresas.length}</b><span>empresas</span></div>
          <div><b>{proposed.etapas.length}</b><span>etapas</span></div>
          <div><b>{proposed.preenchimentos.length}</b><span>campos preenchidos</span></div>
        </div>
        <div className="warning"><AlertTriangle size={19}/> Os dados do mês de destino serão substituídos.
          Os outros meses não serão alterados e <b>todos os checkpoints ficarão desmarcados.</b></div>
        <label className="checkbox-label"><input type="checkbox" checked={confirmed}
          onChange={e=>setConfirmed(e.target.checked)}/>Confirmo a substituição dos dados deste mês.</label>
        <div className="dialog-actions inline-actions"><Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" icon={Copy} disabled={!confirmed} onClick={doApply}>Aplicar sem checkpoints</Button></div>
      </>}
    </div>
  </Modal>;
}
function TasksDialog({state,onClose,onSave}) {
  const l=activeList(state),p=periodOf(state,l);
  const original=periodView(l,p.id);
  const [tasks,setTasks]=useState(clone(original.tasks));
  const change=(i,key,value)=>setTasks(prev=>prev.map((t,j)=>j===i?{...t,[key]:value}:t));
  return <Modal title="Etapas e tipos de campos" wide onClose={onClose} actions={<>
    <Button onClick={onClose}>Cancelar</Button><Button variant="primary" icon={Save} onClick={()=>{if(tasks.filter(t=>t.name.trim()).length){onSave(tasks.filter(t=>t.name.trim()));onClose();}}}>Salvar etapas</Button></>}>
    <p className="muted">Personalize as colunas da lista. Campos de texto e número também podem ser preenchidos por empresa.</p>
    <div className="task-editor">
      {tasks.map((t,i)=><div className="task-row" key={t.id}>
        <GripVertical size={17} className="muted-icon"/><input className="input" value={t.name}
          placeholder="Nome da etapa" onChange={e=>change(i,'name',e.target.value)}/>
        <select className="input" value={safeType(t.type)} onChange={e=>change(i,'type',e.target.value)}>
          <option value="check">Checkbox</option><option value="text">Texto</option>
          <option value="number">Número</option>
        </select><button title="Remover etapa" className="icon-button danger-ink"
          onClick={()=>setTasks(prev=>prev.filter((_,j)=>j!==i))}><Trash2 size={17}/></button>
      </div>)}
    </div>
    <Button icon={Plus} onClick={()=>setTasks(prev=>[...prev,{id:makeId(),name:'',type:'check'}])}>Adicionar etapa</Button>
  </Modal>;
}
function PeriodsDialog({state,onClose,onSave}) {
  const l=activeList(state);const [periods,setPeriods]=useState(clone(l.periods));
  return <Modal title="Gerenciar períodos" onClose={onClose} actions={<>
    <Button onClick={onClose}>Cancelar</Button>
    <Button icon={Save} variant="primary" onClick={()=>{const clean=periods.filter(x=>x.name.trim());
      if(clean.length){onSave(clean);onClose();}}}>Salvar períodos</Button></>}>
    <p className="muted">Cada período mantém suas próprias empresas, etapas e preenchimentos.</p>
    <div className="periods-editor">{periods.map((p,i)=><div className="period-row" key={p.id}>
      <CalendarDays size={17}/><input className="input" value={p.name}
        onChange={e=>setPeriods(prev=>prev.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/>
      <button className="icon-button danger-ink" title="Remover período" disabled={periods.length===1}
        onClick={()=>setPeriods(prev=>prev.filter((_,j)=>j!==i))}><Trash2 size={17}/></button>
    </div>)}</div>
    <Button icon={Plus} onClick={()=>setPeriods(prev=>[...prev,{id:makeId(),name:'Novo período'}])}>Adicionar período</Button>
  </Modal>;
}
function SettingsDialog({state,onClose,onChange}) {
  const theme=state.theme||{};
  return <Modal title="Aparência e preferências" onClose={onClose}>
    <div className="setting-block"><label className="field-label">Tema da interface</label>
      <div className="setting-options">{[
        ['light','Claro'],['dark','Escuro'],['sepia','Sépia'],['midnight','Meia-noite'],['auto','Automático']
      ].map(([value,label])=><button key={value} className={theme.mode===value?'selected':''}
        onClick={()=>onChange({mode:value})}>{label}</button>)}</div></div>
    <div className="setting-block"><label className="field-label">Cor principal</label>
      <div className="palette">{palettes.map(item=><button key={item.value}
        className={theme.accent===item.value?'selected':''} title={item.label}
        style={{background:item.value}} onClick={()=>onChange({accent:item.value})}>
          {theme.accent===item.value&&<Check size={16}/>}</button>)}
        <label className="custom-color" title="Escolher cor personalizada"><input type="color"
          value={theme.accent||'#773d58'} onChange={e=>onChange({accent:e.target.value})}/><Palette size={17}/></label>
      </div></div>
    <div className="setting-block"><label className="field-label">Cantos das janelas</label>
      <div className="setting-options">{[['4px','Retos'],['14px','Suaves'],['22px','Redondos']].map(([size,label])=>
        <button key={size} className={theme.round===size?'selected':''}
          onClick={()=>onChange({round:size})}>{label}</button>)}</div>
    </div>
    <p className="hint"><ShieldCheck size={16}/> Suas preferências são salvas junto aos seus dados no Supabase.</p>
  </Modal>;
}
function ReportsDialog({state,onClose}) {
  const l=activeList(state), current=periodOf(state,l);
  const [type,setType]=useState('monthly'),[pid,setPid]=useState(current.id),
    [week,setWeek]=useState(startOfWeek(today));
  const monthly=useMemo(()=>reportMonth(state,l,pid),[state,l,pid]);
  const events=useMemo(()=>reportWeek(l,week),[l,week]);
  const end=new Date(week);end.setDate(end.getDate()+6);
  const stats=type==='monthly'?[
    ['Total de empresas',monthly.stats.total],
    ['Concluídas',monthly.stats.done],
    ['Em andamento',monthly.stats.part],
    ['Pendentes',monthly.stats.pend]
  ]:[
    ['Marcações na semana',events.length],
    ['Empresas atendidas',new Set(events.map(e=>e.company)).size],
    ['Datas no período',7]
  ];
  function copyText(){
    const text=type==='monthly' ? [
      l.name+' — '+monthly.period,
      ...stats.map(([k,v])=>k+': '+v),
      'Pendências:',
      ...monthly.pending.map(c=>c.name+' | '+c.missing+' | '+c.note)
    ].join('\n') : [
      'Relatório semanal '+dateLabel(week)+' a '+dateLabel(end),
      ...events.map(ev=>dateTime(ev.time)+' | '+ev.company+' | '+ev.task+' | '+ev.period)
    ].join('\n');
    navigator.clipboard?.writeText(text).catch(()=>{});
  }
  return <Modal title="Relatórios" onClose={onClose} wide>
    <div className="report-tools no-print">
      <div className="tab-control"><button className={type==='monthly'?'active':''} onClick={()=>setType('monthly')}>Mensal</button>
        <button className={type==='weekly'?'active':''} onClick={()=>setType('weekly')}>Semanal</button></div>
      {type==='monthly'?<select className="input" value={pid} onChange={e=>setPid(e.target.value)}>
        {l.periods.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>:
        <div className="week-nav"><button onClick={()=>{const d=new Date(week);d.setDate(d.getDate()-7);setWeek(d)}}><ChevronLeft size={17}/></button>
          <span>{dateLabel(week)} — {dateLabel(end)}</span>
          <button onClick={()=>{const d=new Date(week);d.setDate(d.getDate()+7);setWeek(d)}}><ChevronRight size={17}/></button></div>}
      <Button icon={ClipboardCopy} onClick={copyText}>Copiar texto</Button>
      <Button icon={Printer} variant="primary" onClick={()=>window.print()}>Imprimir / PDF</Button>
    </div>
    <div className="print-report"><div className="report-heading"><div className="eyebrow">RELATÓRIO DE ACOMPANHAMENTO</div>
      <h3>{l.name}</h3><p>{type==='monthly'?'Competência: '+monthly.period:'Semana: '+dateLabel(week)+' a '+dateLabel(end)}</p></div>
      <div className="report-stats">{stats.map(([label,value])=><div key={label}><b>{value}</b><span>{label}</span></div>)}</div>
      {type==='monthly'?<>
        <h4>Andamento por etapa</h4><div className="report-bars">{monthly.perTask.map(t=><div className="bar-row" key={t.name}>
          <span>{t.name}</span><div className="bar-track"><span style={{width:(monthly.stats.total?100*t.done/monthly.stats.total:0)+'%'}}/></div>
          <strong>{t.done}/{monthly.stats.total}</strong></div>)}</div>
        <h4>Pendências ({monthly.pending.length})</h4><div className="report-table-wrap"><table className="simple-table"><thead><tr><th>Empresa</th><th>Etapas faltantes</th><th>Observação</th></tr></thead>
          <tbody>{monthly.pending.map((item,i)=><tr key={i}><td>{item.name}</td><td>{item.missing}</td><td>{item.note||'—'}</td></tr>)}</tbody></table></div>
      </>:<>
        <h4>Atividades registradas</h4><div className="report-table-wrap"><table className="simple-table"><thead><tr><th>Data</th><th>Empresa</th><th>Etapa</th><th>Período</th></tr></thead>
        <tbody>{events.map((ev,i)=><tr key={i}><td>{dateTime(ev.time)}</td><td>{ev.company}</td><td>{ev.task}</td><td>{ev.period}</td></tr>)}</tbody></table></div>
      </>}
      {((type==='monthly'&&!monthly.pending.length)||(type==='weekly'&&!events.length))&&
        <div className="empty-report">Nenhum registro para exibir neste relatório.</div>}
      <p className="report-footer">Emitido em {dateTime(Date.now())} • Minhas Listas</p></div>
  </Modal>;
}
function BackupDialog({state,onClose,onRestore,onToast}) {
  const [file,setFile]=useState(null),[confirm,setConfirm]=useState(false);
  const input=useRef();
  const fullBackup=()=>{downloadFile('backup-completo-'+filename(new Date().toISOString().slice(0,10))+'.json',
    JSON.stringify(state,null,2),'application/json;charset=utf-8');
    onToast('Backup completo baixado com todas as marcações.');
  };
  async function readFile(f){
    if(!f)return;if(f.size>20*1024*1024){onToast('Arquivo acima de 20 MB.',true);return;}
    try {const data=JSON.parse(await f.text());if(!data||!Array.isArray(data.lists)||!data.lists.length)
      throw Error('Backup inválido.');
      setFile(data);setConfirm(false);
    }catch(e){onToast(e.message,true);}
  }
  return <Modal title="Backup completo da conta" onClose={onClose}>
    <div className="feature-card"><ArchiveRestore size={26}/><div><b>Guardar uma cópia de segurança</b>
      <p>Inclui todas as listas, empresas, períodos, marcações, relatórios e preferências.</p></div></div>
    <Button variant="primary" icon={Download} onClick={fullBackup}>Baixar backup completo</Button>
    <div className="divider-spacer"/>
    <div className="feature-card"><Upload size={26}/><div><b>Restaurar uma cópia de segurança</b>
      <p>Substitui os dados atuais da conta pelo conteúdo do arquivo.</p></div></div>
    <input ref={input} type="file" accept=".json,application/json" hidden
      onChange={e=>readFile(e.target.files?.[0])}/>
    <Button icon={Upload} onClick={()=>input.current?.click()}>Selecionar backup</Button>
    {file&&<><div className="warning"><AlertTriangle size={17}/> A restauração substituirá todas as listas da conta.</div>
      <label className="checkbox-label"><input type="checkbox" checked={confirm}
        onChange={e=>setConfirm(e.target.checked)}/>Confirmo que desejo restaurar este backup.</label>
      <Button variant="danger" disabled={!confirm} onClick={()=>{onRestore(file);onClose();}}>Restaurar conta</Button></>}
  </Modal>;
}
function HistoryDialog({user,onClose,onRestore,onToast}) {
  const [items,setItems]=useState([]),[loading,setLoading]=useState(true),
    [selected,setSelected]=useState(null);
  useEffect(()=>{let active=true;(async()=>{
    const {data,error}=await sb.from('listas_historico')
      .select('id,operacao,registrado_em,campos_alterados,dados')
      .eq('user_id',user.id).order('id',{ascending:false}).limit(40);
    if(!active)return;
    if(error)onToast('Erro ao carregar histórico: '+error.message,true);
    else setItems(data||[]);
    setLoading(false);
  })();return()=>{active=false;}},[user.id]);
  return <Modal wide title="Histórico de versões" onClose={onClose}>
    <p className="muted">Cada salvamento no Supabase registra uma versão. Você pode recuperar uma versão antiga da conta.</p>
    {loading?<p>Carregando versões…</p>:<div className="history-list">
      {items.map(v=><div className="history-row" key={v.id}>
        <div className="history-icon"><History size={17}/></div><div className="history-details">
          <b>{v.operacao==='INICIAL'?'Versão inicial':v.operacao==='UPDATE'?'Alteração salva':v.operacao==='INSERT'?'Primeira gravação':'Exclusão registrada'}</b>
          <span>{dateTime(v.registrado_em)} • Versão #{v.id}</span>
        </div><Button disabled={!v.dados?.lists} onClick={()=>setSelected(v)}>Restaurar</Button>
      </div>)}
      {!items.length&&<div className="empty-report">Ainda não existem versões registradas.</div>}</div>}
    {selected&&<div className="restore-confirm">
      <div className="warning"><AlertTriangle size={19}/> Restaurar a versão #{selected.id} substitui os dados atuais, mas criará um novo registro de histórico.</div>
      <div className="dialog-actions inline-actions"><Button onClick={()=>setSelected(null)}>Cancelar</Button>
        <Button variant="danger" onClick={()=>{onRestore(selected.dados);onClose();}}>Confirmar restauração</Button></div>
    </div>}
  </Modal>;
}
