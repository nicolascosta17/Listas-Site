import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {
  LayoutDashboard,ListChecks,Plus,Search,Check,Clock3,MoreHorizontal,FileText,
  Download,Upload,Copy,Settings2,LogOut,Menu,PanelLeftClose,PanelLeftOpen,X,
  Save,RotateCcw,Trash2,Edit3,CalendarDays,FileBarChart2,ChevronLeft,
  ChevronRight,ChevronDown,ShieldCheck,AlertTriangle,Cloud,CloudOff,CheckCircle2,
  Building2,CheckSquare,SlidersHorizontal,Filter,Palette,ArchiveRestore,
  History,LockKeyhole,ArrowRight,Printer,Hash,GripVertical,Sparkles,
  FolderPlus,Columns3,ArrowUpDown,Maximize2,ExternalLink
} from 'lucide-react';
import {sb} from './supabase.js';
import {
  clone,makeId,activeList,periodOf,periodView,ensureActive,syncActive,prepareData,
  blankList,addCompany,periodKey,safeType,taskDone,companyStatus,counter,
  viewCompanies,purgeEntries,templateFrom,validateTemplate,applyTemplate,
  downloadFile,filename
} from './model.js';
import {
  Button,Modal,Toast,AuthScreen,EditableCell,TransferDialog,TasksDialog,
  PeriodsDialog,SettingsDialog,ReportsDialog,BackupDialog,HistoryDialog
} from './components.jsx';

const statusWords={done:'Concluído',part:'Em andamento',pend:'Pendente'};
const widths={number:86,company:272,status:154,note:250,actions:57};
const defaultsFor=(key,task)=>widths[key] || (task?.type==='number'?148:task?.type==='text'?225:174);
const validHex=x=>/^#[0-9a-fA-F]{6}$/.test(x||'')?x:'#773d58';

export default function App(){
  const [user,setUser]=useState(undefined);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [fatal,setFatal]=useState('');
  const [syncStatus,setSyncStatus]=useState('saved');
  const [toast,setToast]=useState(null);
  const [dialog,setDialog]=useState(null);
  const [draft,setDraft]=useState('');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState('all');
  const [mobileMenu,setMobileMenu]=useState(false);
  const [menuOpen,setMenuOpen]=useState(false);
  const [liveWidths,setLiveWidths]=useState({});
  const [newCompany,setNewCompany]=useState('');
  const dataRef=useRef(null),userRef=useRef(null),dirtyRef=useRef(false),
    savingRef=useRef(null),timerRef=useRef(null),updatedAtRef=useRef(null),
    lastSavedRef=useRef(''),loadIdRef=useRef(0),conflictRef=useRef(false);
  const notify=useCallback((text,error=false)=>setToast({text,error,id:Date.now()}),[]);

  const load=useCallback(async (u)=>{
    if(!u)return;
    const id=++loadIdRef.current;
    userRef.current=u;setUser(u);setLoading(true);setFatal('');
    clearTimeout(timerRef.current);
    const {data:record,error}=await sb.from('listas_dados')
      .select('dados,updated_at').eq('user_id',u.id).maybeSingle();
    if(id!==loadIdRef.current)return;
    if(error){setFatal('Não foi possível carregar suas listas: '+error.message);setLoading(false);return;}
    let raw=record?.dados;
    // Importa dados do navegador somente quando não existe registro na conta.
    if(!raw){
      try {const legacy=JSON.parse(localStorage.getItem('listas-v1'));if(legacy?.lists)raw=legacy;}
      catch(_){}
    }
    const normalized=prepareData(raw);
    updatedAtRef.current=record?.updated_at||null;
    lastSavedRef.current=JSON.stringify(normalized);
    dataRef.current=normalized;
    dirtyRef.current=false;conflictRef.current=false;
    setData(normalized);setSyncStatus('saved');setLoading(false);
  },[]);

  useEffect(()=>{
    let mounted=true;
    sb.auth.getSession().then(({data:res,error})=>{
      if(!mounted)return;
      if(error){setFatal(error.message);setLoading(false);setUser(null);return;}
      if(res.session?.user){if(userRef.current?.id!==res.session.user.id)load(res.session.user);}
      else {setUser(null);setLoading(false);}
    });
    const {data:{subscription}}=sb.auth.onAuthStateChange((event,session)=>{
      if(event==='SIGNED_OUT'){
        ++loadIdRef.current;clearTimeout(timerRef.current);
        userRef.current=null;dataRef.current=null;setUser(null);setData(null);
        dirtyRef.current=false;setSyncStatus('saved');setLoading(false);
      } else if(event==='SIGNED_IN' && session?.user && userRef.current?.id!==session.user.id){
        load(session.user);
      }
    });
    return ()=>{mounted=false;subscription.unsubscribe();clearTimeout(timerRef.current);};
  },[load]);

  async function persist(){
    if(!userRef.current||!dataRef.current||!dirtyRef.current||conflictRef.current)return false;
    if(savingRef.current) {
      await savingRef.current;
      if(dirtyRef.current&&!conflictRef.current)return persist();
      return !dirtyRef.current;
    }
    clearTimeout(timerRef.current);
    const snapshot=clone(dataRef.current),json=JSON.stringify(snapshot);
    if(json===lastSavedRef.current){
      dirtyRef.current=false;setSyncStatus('saved');return true;
    }
    const uid=userRef.current.id, previous=updatedAtRef.current;
    const work=(async()=>{
      setSyncStatus('saving');
      try {
        const timestamp=new Date().toISOString();
        const q=previous
          ?sb.from('listas_dados').update({dados:snapshot,updated_at:timestamp})
            .eq('user_id',uid).eq('updated_at',previous).select('updated_at').maybeSingle()
          :sb.from('listas_dados').insert({user_id:uid,dados:snapshot,updated_at:timestamp})
            .select('updated_at').single();
        const {data:result,error}=await q;
        if(error)throw Error(error.message);
        if(!result){
          conflictRef.current=true;setSyncStatus('conflict');
          notify('Outro dispositivo atualizou estas listas. Faça um backup antes de recarregar.',true);
          return false;
        }
        updatedAtRef.current=result.updated_at;
        lastSavedRef.current=json;
        dirtyRef.current=JSON.stringify(dataRef.current)!==json;
        setSyncStatus(dirtyRef.current?'pending':'saved');
        return true;
      }catch(err){
        const message=err.message||'Erro de conexão';
        if(message.includes('duplicate key')){conflictRef.current=true;setSyncStatus('conflict');}
        else setSyncStatus('error');
        notify('Falha ao salvar: '+message,true);
        return false;
      }
    })();
    savingRef.current=work;
    const ok=await work;
    if(savingRef.current===work)savingRef.current=null;
    if(ok&&dirtyRef.current&&dataRef.current?.autoSave!==false&&!conflictRef.current){
      timerRef.current=setTimeout(()=>persist(),700);
    }
    return ok;
  }

  function modify(mutator,force=false){
    if(!dataRef.current)return;
    const next=clone(dataRef.current);
    mutator(next);
    dataRef.current=next;setData(next);
    dirtyRef.current=JSON.stringify(next)!==lastSavedRef.current;
    if(!dirtyRef.current){setSyncStatus('saved');return;}
    conflictRef.current=false;
    setSyncStatus('pending');
    clearTimeout(timerRef.current);
    if(next.autoSave!==false||force)timerRef.current=setTimeout(()=>persist(),850);
  }
  function editCurrent(mutator){
    modify(s=>{
      const l=activeList(s);ensureActive(s,l);const p=periodOf(s,l);
      mutator(l,p,s);syncActive(s,l);
    });
  }
  const reload=async()=>{
    if(!userRef.current)return;
    if(dirtyRef.current&&!window.confirm('Descartar edições não salvas e carregar a versão do Supabase?'))return;
    await load(userRef.current);notify('Dados atualizados a partir do Supabase.');
  };
  useEffect(()=>{
    if(!user||!data)return;
    const timer=setInterval(async()=>{
      if(document.hidden||dirtyRef.current||savingRef.current||conflictRef.current||
        document.querySelector('.modal-backdrop')||
        document.activeElement?.matches('input,textarea,select,[contenteditable="true"]'))return;
      const {data:record,error}=await sb.from('listas_dados')
        .select('dados,updated_at').eq('user_id',user.id).maybeSingle();
      if(error||!record?.dados||record.updated_at===updatedAtRef.current)return;
      if(dirtyRef.current||savingRef.current)return;
      const normalized=prepareData(record.dados);
      dataRef.current=normalized;updatedAtRef.current=record.updated_at;
      lastSavedRef.current=JSON.stringify(normalized);
      setData(normalized);setSyncStatus('saved');
      notify('Novas alterações sincronizadas de outro dispositivo.');
    },12000);
    return ()=>clearInterval(timer);
  },[user?.id,Boolean(data),load,notify]);

  useEffect(()=>{
    const fn=e=>{if(dirtyRef.current){e.preventDefault();e.returnValue='';}};
    window.addEventListener('beforeunload',fn);
    return ()=>window.removeEventListener('beforeunload',fn);
  },[]);
  const theme=data?.theme||{};
  const effectiveMode=theme.mode==='auto'?
    (window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'):
    (theme.mode||'light');
  useEffect(()=>{
    document.documentElement.dataset.theme=effectiveMode;
    document.documentElement.style.setProperty('--accent',validHex(theme.accent));
    document.documentElement.style.setProperty('--radius',theme.round||'14px');
  },[effectiveMode,theme.accent,theme.round]);

  if(user===undefined||loading)return <div className="app-loader"><div className="loader-brand"><ListChecks size={36}/></div><span>Carregando Minhas Listas…</span></div>;
  if(!user)return <AuthScreen onReady={load}/>;
  if(fatal)return <div className="fatal-screen"><AlertTriangle size={34}/><h2>Falha ao carregar</h2><p>{fatal}</p>
    <Button icon={RotateCcw} onClick={reload}>Tentar novamente</Button></div>;
  if(!data||!data.lists?.length)return <div className="app-loader">Preparando seu ambiente…</div>;

  const current=activeList(data),period=periodOf(data,current);
  const currentView=periodView(current,period.id);
  const metrics=counter(current,period.id,currentView);
  const companies=viewCompanies(data,current,period.id,currentView,query,filter);
  const collapsed=!!currentView.sidebarCollapsed;

  function selectList(id){
    modify(s=>{
      s.cur=id;const l=activeList(s);
      ensureActive(s,l);
    });
    setQuery('');setFilter('all');setMobileMenu(false);setLiveWidths({});
  }
  function selectPeriod(id){
    modify(s=>{const l=activeList(s);s.per[l.id]=id;ensureActive(s,l,id);});
    setQuery('');setFilter('all');setLiveWidths({});
  }
  function openSimple(type,value=''){
    setDraft(value);setDialog({type});
  }
  function saveSimple(){
    const value=draft.trim();if(!value){notify('Preencha o nome para continuar.',true);return;}
    if(dialog.type==='newList'){
      modify(s=>{const l=blankList(value);s.lists.push(l);s.cur=l.id;s.per[l.id]=l.periods[0].id;syncActive(s,l);});
    }else if(dialog.type==='rename'){
      editCurrent(l=>{l.name=value;});
    }else if(dialog.type==='newPeriod'){
      modify(s=>{
        const l=activeList(s);const old=periodOf(s,l);ensureActive(s,l,old.id);
        syncActive(s,l);
        const p={id:makeId(),name:value};
        l.periods.push(p);s.per[l.id]=p.id;
        ensureActive(s,l,p.id);
      });
    }
    setDialog(null);setDraft('');notify('Alterações feitas com sucesso.');
  }
  function deleteList(){
    modify(s=>{
      s.lists=s.lists.filter(l=>l.id!==current.id);
      if(!s.lists.length){const l=blankList();s.lists=[l];s.per[l.id]=l.periods[0].id;syncActive(s,l);}
      s.cur=s.lists[0].id;
    });
    setDialog(null);setQuery('');notify('Lista excluída.');
  }
  function taskSave(tasks){
    editCurrent((l,p)=>{
      const removed=l.tasks.filter(t=>!tasks.some(x=>x.id===t.id&&safeType(x.type)===safeType(t.type)));
      for(const t of removed)purgeEntries(l,p.id,undefined,t.id);
      l.tasks=tasks.map(t=>({...t,name:t.name.trim(),type:safeType(t.type)}));
    });notify('Etapas atualizadas.');
  }
  function periodSave(periods){
    modify(s=>{
      const l=activeList(s);const oldId=periodOf(s,l)?.id;ensureActive(s,l,oldId);syncActive(s,l);
      const keep=new Set(periods.map(p=>p.id));
      for(const id of Object.keys(l.periodData||{}))if(!keep.has(id))delete l.periodData[id];
      for(const map of [l.checks,l.values])for(const key of Object.keys(map||{}))
        if(!keep.has(key.split('|')[0]))delete map[key];
      l.periods=periods.map(p=>({...p,name:p.name.trim()}));
      if(!keep.has(oldId)){
        const nextId=l.periods[0].id;
        const next=l.periodData[nextId]||l.periodTemplate||{companies:[],tasks:[]};
        l.companies=clone(next.companies||[]);
        l.tasks=clone(next.tasks||[]);
        l.activePeriodId=nextId;s.per[l.id]=nextId;
      }
      ensureActive(s,l);syncActive(s,l);
    });notify('Períodos atualizados.');
  }
  function removeCompany(id){
    editCurrent((l,p)=>{l.companies=l.companies.filter(c=>c.id!==id);purgeEntries(l,p.id,id);});
    setDialog(null);notify('Empresa removida deste mês.');
  }
  function updateCell(c,t,value){
    editCurrent((l,p)=>{
      const key=periodKey(p.id,c.id,t.id);
      if(safeType(t.type)==='check'){
        if(value)l.checks[key]=Date.now();else delete l.checks[key];
      }else{
        if(value===''||value===null){delete l.values[key];delete l.checks[key];}
        else {l.values[key]=value;if(!l.checks[key])l.checks[key]=Date.now();}
      }
    });
  }
  function editCompanyField(c,key,value){
    editCurrent(l=>{const found=l.companies.find(x=>x.id===c.id);if(found)found[key]=value;});
  }
  function handleCompanyAdd(e){
    e?.preventDefault();const name=newCompany.trim();if(!name)return;
    editCurrent(l=>addCompany(l,name));setNewCompany('');notify('Empresa adicionada.');
  }
  function widthOf(key,t){
    return liveWidths[key]||Number(currentView.columnWidths?.[key])||defaultsFor(key,t);
  }
  function startResize(e,key,task){
    if(e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    const initial=widthOf(key,task),start=e.clientX;
    let final=initial;
    const move=ev=>{final=Math.max(70,Math.min(620,Math.round(initial+ev.clientX-start)));
      setLiveWidths(old=>({...old,[key]:final}));};
    const stop=()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',stop);
      editCurrent((l,p)=>{l.periodData[p.id] ||= {};
        l.periodData[p.id].columnWidths={...(l.periodData[p.id].columnWidths||{}),[key]:final};
      });
      setLiveWidths({});
    };
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',stop);
  }
  function applyTransfer(template){
    modify(s=>applyTemplate(s,template));
    notify('Modelo aplicado: empresas e etapas transferidas; checkpoints desmarcados.');
  }
  function restoreAll(raw){
    const normalized=prepareData(raw);
    modify(s=>{Object.keys(s).forEach(k=>delete s[k]);Object.assign(s,normalized);},true);
    notify('Restauração aplicada. Confira o indicador de salvamento.');
  }
  function logout(){
    if(dirtyRef.current&&!window.confirm('Há alterações não salvas. Deseja sair mesmo assim?'))return;
    sb.auth.signOut();
  }

  return <div className={'layout '+(collapsed?'is-collapsed':'')}>
    {mobileMenu&&<button className="mobile-overlay" aria-label="Fechar menu" onClick={()=>setMobileMenu(false)}/>}
    <aside className={'sidebar '+(mobileMenu?'sidebar-open':'')}>
      <div className="sidebar-head"><div className="brand-icon"><ListChecks size={24} strokeWidth={2.2}/></div>
        <div className="brand-text"><b>Minhas Listas</b><span>CONTIDADOS WORKSPACE</span></div>
        <button className="sidebar-toggle" title={collapsed?"Expandir menu":"Recolher menu"}
          aria-label={collapsed?"Expandir menu":"Recolher menu"}
          onClick={()=>editCurrent((l,p)=>{l.periodData[p.id] ||= {};
            l.periodData[p.id].sidebarCollapsed=!collapsed;})}>
          {collapsed?<PanelLeftOpen size={17}/>:<PanelLeftClose size={17}/>}
        </button></div>
      <div className="list-section-title"><span>MINHAS LISTAS</span>
        <button title="Criar nova lista" aria-label="Criar nova lista" onClick={()=>openSimple('newList')}>
          <Plus size={17}/></button></div>
      <nav className="nav-lists" aria-label="Listas">
        {data.lists.map(l=>{
          const p=periodOf(data,l),view=periodView(l,p.id),c=counter(l,p.id,view);
          return <button key={l.id} className={'list-link '+(current.id===l.id?'selected':'')}
            title={l.name} onClick={()=>selectList(l.id)}>
            <span className="list-icon"><ListChecks size={17}/></span>
            <span className="list-label">{l.name}</span><small>{c.done}/{c.total}</small></button>;
        })}
      </nav>
      <div className="sidebar-grow"/>
      <div className="sidebar-bottom">
        <button className="side-bottom-action" onClick={()=>setDialog({type:'settings'})}><Settings2 size={18}/><span>Configurações</span></button>
        <div className="sidebar-account">
          <div className="avatar">{user.email?.[0]?.toUpperCase()||'U'}</div>
          <div className="account-info"><strong>{user.email?.split('@')[0]}</strong><span>{user.email}</span></div>
          <button className="logout-btn" title="Sair" aria-label="Sair" onClick={logout}><LogOut size={18}/></button>
        </div>
      </div>
    </aside>

    <main className="main-area">
      <div className="mobile-top"><button className="icon-button" onClick={()=>setMobileMenu(true)} aria-label="Abrir menu"><Menu size={23}/></button>
        <b>Minhas Listas</b><span className="mobile-top-spacer"/>
        <button className="icon-button" onClick={()=>setDialog({type:'settings'})} aria-label="Configurações"><Settings2 size={20}/></button></div>
      <header className="topbar">
        <div className="topbar-title"><span>CONTIDADOS</span><i></i><b>Minhas Listas</b></div>
        <div className="topbar-right">
          <div className={'sync-indicator '+syncStatus}>
            {syncStatus==='saved'?<CheckCircle2 size={16}/>:
              syncStatus==='saving'?<Cloud size={16}/>:
              syncStatus==='pending'?<Clock3 size={16}/>:<CloudOff size={16}/>}
            <span>{syncStatus==='saved'?'Tudo salvo':syncStatus==='saving'?'Salvando…':
              syncStatus==='pending'?'Alterações pendentes':
              syncStatus==='conflict'?'Conflito de versões':'Erro ao salvar'}</span>
          </div>
          <Button icon={Save} variant="primary" onClick={()=>persist()}
            disabled={!dirtyRef.current||syncStatus==='saving'}>Salvar</Button>
          <div className="user-avatar" title={user.email}>{user.email?.[0]?.toUpperCase()||'U'}</div>
        </div>
      </header>
      <div className="content-scroll"><div className="page-body">
        {(syncStatus==='error'||syncStatus==='conflict')&&<div className="sync-warning">
          <AlertTriangle size={19}/>
          <span>{syncStatus==='conflict'?'Existe uma versão mais recente no banco de dados. Exporte um backup antes de carregar outra versão.':'O salvamento falhou. Verifique a conexão e tente novamente.'}</span>
          <Button icon={RotateCcw} onClick={syncStatus==='conflict'?reload:persist}>{syncStatus==='conflict'?'Recarregar':'Tentar novamente'}</Button>
        </div>}

        <div className="page-intro">
          <div className="page-title-area">
            <span className="page-kicker">LISTA ATIVA</span>
            <div className="page-title-line">
              <h1>{current.name}</h1>
              <button className="title-edit" title="Renomear lista" aria-label="Renomear lista"
                onClick={()=>openSimple('rename',current.name)}><Edit3 size={17}/></button>
            </div>
          </div>
          <div className="intro-actions">
            <div className="menu-wrap">
              <button className="more-button" onClick={()=>setMenuOpen(!menuOpen)}
                aria-expanded={menuOpen} aria-haspopup="true"><MoreHorizontal size={19}/> Opções <ChevronDown size={14}/></button>
              {menuOpen&&<div className="dropdown-menu">
                <button onClick={()=>{setDialog({type:'tasks'});setMenuOpen(false)}}><Columns3 size={17}/>Editar etapas</button>
                <button onClick={()=>{setDialog({type:'periods'});setMenuOpen(false)}}><CalendarDays size={17}/>Gerenciar meses</button>
                <button onClick={()=>{setDialog({type:'transfer'});setMenuOpen(false)}}><Copy size={17}/>Copiar ou importar dados</button>
                <button onClick={()=>{setDialog({type:'reports'});setMenuOpen(false)}}><FileBarChart2 size={17}/>Relatórios</button>
                <div className="dropdown-divider"/>
                <button onClick={()=>{setDialog({type:'history'});setMenuOpen(false)}}><History size={17}/>Histórico</button>
                <button onClick={()=>{setDialog({type:'backup'});setMenuOpen(false)}}><ArchiveRestore size={17}/>Backup</button>
                <button onClick={()=>{setDialog({type:'settings'});setMenuOpen(false)}}><Settings2 size={17}/>Aparência</button>
                <div className="dropdown-divider"/>
                <button onClick={()=>{setDialog({type:'deleteList'});setMenuOpen(false)}} className="danger-ink"><Trash2 size={17}/>Excluir lista</button>
              </div>}</div>
          </div>
        </div>
        <section className="compact-summary" aria-label="Resumo da competência">
          <div className="summary-stats">
            <span><b>{metrics.total}</b> empresas</span>
            <span className="summary-stat-completed"><b>{metrics.done}</b> concluídas</span>
            <span><b>{metrics.part+metrics.pend}</b> pendentes</span>
          </div>
          <div className="mini-progress">
            <span>{metrics.percent}% concluído</span>
            <div className="mini-progress-track"><i style={{width:metrics.percent+'%'}}/></div>
          </div>
        </section>
        <section className="workspace-card">

          <div className="workspace-heading">
            <div><h2>Empresas</h2></div>
            <div className="section-actions">
              <Button icon={Copy} onClick={()=>setDialog({type:'transfer'})}>Copiar dados</Button>
              <Button icon={FileBarChart2} onClick={()=>setDialog({type:'reports'})}>Relatórios</Button>
            </div>
          </div>
          <div className="period-line">
            <button className="period-nav" title="Mês anterior"
              onClick={()=>{const i=current.periods.findIndex(x=>x.id===period.id);selectPeriod(current.periods[(i-1+current.periods.length)%current.periods.length].id);}}>
              <ChevronLeft size={17}/></button>
            <div className="period-tabs">
              {current.periods.map(p=><button key={p.id} className={'period-tab '+(period.id===p.id?'active':'')}
                onClick={()=>selectPeriod(p.id)}>{p.name}</button>)}
            </div>
            <button className="period-nav" title="Próximo mês"
              onClick={()=>{const i=current.periods.findIndex(x=>x.id===period.id);selectPeriod(current.periods[(i+1)%current.periods.length].id);}}>
              <ChevronRight size={17}/></button>
            <button className="add-period-button" title="Criar período" onClick={()=>openSimple('newPeriod')}><Plus size={17}/></button>
          </div>
          <div className="table-toolbar">
            <div className="search-wrap"><Search size={19}/>
              <input type="search" placeholder="Buscar empresa…" value={query} onChange={e=>setQuery(e.target.value)}/>
              {query&&<button title="Limpar pesquisa" onClick={()=>setQuery('')}><X size={15}/></button>}</div>
            <div className="filter-tabs">
              <button className={filter==='all'?'active':''} onClick={()=>setFilter('all')}>Todas</button>
              <button className={filter==='open'?'active':''} onClick={()=>setFilter('open')}>Em aberto</button>
              <button className={filter==='done'?'active':''} onClick={()=>setFilter('done')}>Concluídas</button>
            </div>
            <div className="select-sort"><ArrowUpDown size={16}/><select value={data.sortOrders?.[current.id]||'number-asc'}
              onChange={e=>modify(s=>{s.sortOrders ||= {};s.sortOrders[current.id]=e.target.value;})}>
                <option value="number-asc">Número crescente</option>
                <option value="number-desc">Número decrescente</option>
                <option value="alpha-asc">Nome A–Z</option>
                <option value="alpha-desc">Nome Z–A</option>
              </select></div>
          </div>
          <form className="new-company-form" onSubmit={handleCompanyAdd}>
            <span className="new-company-circle"><Plus size={17}/></span>
            <input id="new-company-input" value={newCompany} onChange={e=>setNewCompany(e.target.value)}
              placeholder="Adicionar nova empresa…"/>
            <button type="submit" disabled={!newCompany.trim()}><Plus size={15}/>Adicionar</button>
          </form>
          <div className="data-table-outer">
            <table className="data-table" key={current.id+'|'+period.id}>
              <colgroup>
                <col style={{width:widthOf('number')}}/><col style={{width:widthOf('company')}}/>
                {currentView.tasks.map(t=><col key={t.id} style={{width:widthOf('task:'+t.id,t)}}/>)}
                <col style={{width:widthOf('status')}}/><col style={{width:widthOf('note')}}/>
                <col style={{width:widthOf('actions')}}/>
              </colgroup>
              <thead><tr>
                <th className="th-number">Nº<span className="resize-handle" onPointerDown={e=>startResize(e,'number')}/></th>
                <th>Empresa<span className="resize-handle" onPointerDown={e=>startResize(e,'company')}/></th>
                {currentView.tasks.map(t=><th key={t.id} className="th-task">{t.name}<span className="resize-handle"
                  onPointerDown={e=>startResize(e,'task:'+t.id,t)}/></th>)}
                <th>Status<span className="resize-handle" onPointerDown={e=>startResize(e,'status')}/></th>
                <th>Observações<span className="resize-handle" onPointerDown={e=>startResize(e,'note')}/></th>
                <th className="th-actions"></th></tr></thead>
              <tbody>
                {companies.map(c=>{
                  const st=companyStatus(current,period.id,c,currentView.tasks);
                  return <tr key={c.id}>
                    <td className="number-cell"><input type="number" min="0" step="1"
                      value={c.number??''} aria-label={'Número de '+c.name}
                      onChange={e=>{const n=e.target.value; if(n===''||(Number.isSafeInteger(Number(n))&&Number(n)>=0))editCompanyField(c,'number',n===''?'':Number(n));}}/></td>
                    <td><EditableCell value={c.name} title="Nome da empresa"
                      className="company-name-input" onChange={v=>{if(v.trim())editCompanyField(c,'name',v)}}/></td>
                    {currentView.tasks.map(t=>{
                      const type=safeType(t.type),key=periodKey(period.id,c.id,t.id),value=current.values?.[key]??'';
                      return <td key={t.id} className={'task-cell '+(type==='check'?'check-cell':'')}>
                        {type==='check'?<label className="checkbox-control">
                          <input type="checkbox" checked={Boolean(current.checks?.[key])} aria-label={t.name+' - '+c.name}
                            onChange={e=>updateCell(c,t,e.target.checked)}/><span className="checkbox-visual"><Check size={13}/></span>
                        </label>:<EditableCell className="task-value" type={type==='number'?'number':'text'}
                          value={value} placeholder={type==='number'?'0':'Preencher…'} title={t.name+' / '+c.name}
                          onChange={v=>updateCell(c,t,v)}/>}
                      </td>;
                    })}
                    <td><span className={'status-pill '+st}><span className="status-dot"/>{statusWords[st]}</span></td>
                    <td><EditableCell className="note-input" value={c.note||''} placeholder="Adicionar observação…"
                      onChange={v=>editCompanyField(c,'note',v)}/></td>
                    <td className="row-actions"><button className="row-remove" title={'Excluir '+c.name}
                      aria-label={'Excluir '+c.name}
                      onClick={()=>setDialog({type:'deleteCompany',id:c.id,name:c.name})}><Trash2 size={17}/></button></td>
                  </tr>;
                })}
                {!companies.length&&<tr><td className="empty-table" colSpan={currentView.tasks.length+5}>
                  <div className="empty-illustration"><Building2 size={28}/></div>
                  <b>{metrics.total?'Nenhuma empresa encontrada':'Sua lista ainda está vazia'}</b>
                  <p>{metrics.total?'Tente outro filtro ou pesquise um nome diferente.':'Cadastre uma empresa para começar a organizar esta competência.'}</p>
                  {!metrics.total&&<button onClick={()=>document.getElementById('new-company-input')?.focus()}>
                    <Plus size={16}/> Adicionar empresa</button>}
                </td></tr>}
              </tbody>
            </table>
          </div>
          <div className="table-footer"><span>Exibindo <b>{companies.length}</b> de <b>{metrics.total}</b> empresas</span>
            <div><label className="inline-check"><input type="checkbox" checked={data.autoSave!==false}
              onChange={e=>modify(s=>{s.autoSave=e.target.checked;},true)}/>Salvar automático</label>
              <Button icon={Save} onClick={persist} disabled={!dirtyRef.current}>Salvar agora</Button></div>
          </div>
        </section>
</div></div>
    </main>

    {dialog?.type==='transfer'&&<TransferDialog state={data} current={current} onClose={()=>setDialog(null)}
      onApply={applyTransfer} onToast={notify}/>}
    {dialog?.type==='tasks'&&<TasksDialog state={data} onClose={()=>setDialog(null)} onSave={taskSave}/>}
    {dialog?.type==='periods'&&<PeriodsDialog state={data} onClose={()=>setDialog(null)} onSave={periodSave}/>}
    {dialog?.type==='settings'&&<SettingsDialog state={data} onClose={()=>setDialog(null)}
      onChange={patch=>modify(s=>{s.theme={...s.theme,...patch};})}/>}
    {dialog?.type==='reports'&&<ReportsDialog state={data} onClose={()=>setDialog(null)}/>}
    {dialog?.type==='backup'&&<BackupDialog state={data} onClose={()=>setDialog(null)}
      onRestore={restoreAll} onToast={notify}/>}
    {dialog?.type==='history'&&<HistoryDialog user={user} onClose={()=>setDialog(null)}
      onRestore={restoreAll} onToast={notify}/>}
    {['newList','rename','newPeriod'].includes(dialog?.type)&&<Modal onClose={()=>setDialog(null)}
      title={dialog.type==='newList'?'Criar nova lista':dialog.type==='rename'?'Renomear lista':'Adicionar período'}
      actions={<><Button onClick={()=>setDialog(null)}>Cancelar</Button>
        <Button variant="primary" icon={Save} onClick={saveSimple}>Salvar</Button></>}>
      <label className="field-label">{dialog.type==='newList'?'Nome da lista':dialog.type==='rename'?'Novo nome':'Nome do período'}</label>
      <input className="input" autoFocus value={draft} placeholder="Digite um nome"
        onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')saveSimple();}}/>
    </Modal>}
    {dialog?.type==='deleteList'&&<Modal title="Excluir lista?" onClose={()=>setDialog(null)}
      actions={<><Button onClick={()=>setDialog(null)}>Cancelar</Button>
        <Button variant="danger" icon={Trash2} onClick={deleteList}>Excluir lista</Button></>}>
      <div className="warning"><AlertTriangle size={19}/> Excluir a lista <b>{current.name}</b> remove todos os seus meses, empresas e preenchimentos desta conta.</div>
    </Modal>}
    {dialog?.type==='deleteCompany'&&<Modal title="Remover empresa?" onClose={()=>setDialog(null)}
      actions={<><Button onClick={()=>setDialog(null)}>Cancelar</Button>
        <Button variant="danger" icon={Trash2} onClick={()=>removeCompany(dialog.id)}>Remover</Button></>}>
      <p>Remover <b>{dialog.name}</b> desta competência? As demais competências não serão afetadas.</p>
    </Modal>}
    <Toast toast={toast} onClose={()=>setToast(null)}/>
  </div>;
}
