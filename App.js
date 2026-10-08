import { useState, useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Dimensions, TextInput, Modal, Share, ActivityIndicator, FlatList } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import * as ImagePicker from "expo-image-picker";
import * as Device from 'expo-device';
import * as ScreenCapture from 'expo-screen-capture';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Updates from 'expo-updates';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, increment, where } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const { height, width } = Dimensions.get('window');
const CREATOR_RATE = 0.0005;
const WATCH_RATE = 0.01;
const WELCOME_BONUS = 10;
const MIN_WITHDRAW = 100;
const FEE_PERCENT = 10;
const DAILY_LIMIT = 500;

const firebaseConfig = {
  apiKey: "AIzaSyCdjBgOFF8pa8b8GoFXuZazQXSYViN0XQA",
  authDomain: "reelbaaz-fa44b.firebaseapp.com",
  projectId: "reelbaaz-fa44b",
  storageBucket: "reelbaaz-fa44b.firebasestorage.app",
  messagingSenderId: "914055901645",
  appId: "1:914055901645:web:212030031d93e48caf5484",
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

function VideoItem({ v, isActive, onWatched, myId }){
  const player = useVideoPlayer(v.url, p=>{p.loop=true;});
  const watched = useRef(false);
  useEffect(()=>{
    if(isActive){
      player.play();
      if(!watched.current){
        const randomTime = 3000 + Math.random()*5000;
        const t=setTimeout(()=>{
          if(!watched.current && v.bazzId!==myId){
            watched.current=true;
            onWatched(v.id, v.bazzId);
          }
        }, randomTime);
        return ()=>clearTimeout(t);
      }
    }else{
      player.pause();
      watched.current=false;
    }
  },[isActive]);
  return(
    <View style={styles.videoContainer}>
      <VideoView player={player} style={styles.video} contentFit="cover" nativeControls={false} />
      <View style={styles.vOverlay}><Text style={styles.vUser}>{v.bazzId}</Text><Text style={styles.vViews}>{v.views||0} views</Text></View>
      <View style={styles.watchTag}><Text style={styles.watchTagT}>+₹{WATCH_RATE}</Text></View>
    </View>
  )
}

export default function App(){
  const [isLoggedIn,setIsLoggedIn]=useState(false);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState('home');
  const [videos,setVideos]=useState([]);
  const [myId,setMyId]=useState('');
  const [myName,setMyName]=useState('');
  const [myPhone,setMyPhone]=useState('');
  const [watchedCount,setWatchedCount]=useState(0);
  const [dailyWatched,setDailyWatched]=useState(0);
  const [joinDate,setJoinDate]=useState(null);
  const [upiId,setUpiId]=useState('');
  const [withdrawAmt,setWithdrawAmt]=useState('');
  const [showInvite,setShowInvite]=useState(false);
  const [showCreate,setShowCreate]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [loginName,setLoginName]=useState('');
  const [loginPhone,setLoginPhone]=useState('');
  const [loginIdName,setLoginIdName]=useState('');
  const [checking,setChecking]=useState(false);
  const [activeIndex,setActiveIndex]=useState(0);

  const onViewableItemsChanged = useRef(({viewableItems})=>{
    if(viewableItems.length>0) setActiveIndex(viewableItems[0].index);
  }).current;
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 80, minimumViewTime: 300 }).current;

  useEffect(()=>{
    (async()=>{
      // AUTO UPDATE CHECK
      try {
        if (!__DEV__) {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        }
      } catch(e) {}

      const savedId=await AsyncStorage.getItem('bazz_id');
      const savedName=await AsyncStorage.getItem('bazz_name');
      const savedPhone=await AsyncStorage.getItem('bazz_phone');
      const savedJoin=await AsyncStorage.getItem('join_date');
      if(savedId && savedName){
        setMyId(savedId); setMyName(savedName); setMyPhone(savedPhone||'');
        setJoinDate(savedJoin?new Date(savedJoin):new Date());
        setIsLoggedIn(true);
        const wc=await AsyncStorage.getItem('watched_'+savedId);
        if(wc) setWatchedCount(parseInt(wc));
        const today=new Date().toDateString();
        const daily=await AsyncStorage.getItem('daily_'+savedId+'_'+today);
        if(daily) setDailyWatched(parseInt(daily));
      }
      setLoading(false);
      const snap=await getDocs(query(collection(db,"videos"),orderBy("createdAt","desc")));
      setVideos(snap.docs.map(d=>({id:d.id,...d.data()})));
    })();
  },[]);

  const handleLogin=async()=>{
    if(loginName.length<3) return Alert.alert('Naam 3 akshar');
    if(loginPhone.length<10) return Alert.alert('Mobile 10 digit');
    if(loginIdName.length<3) return Alert.alert('ID 3 akshar');
    const cleanId=loginIdName.toLowerCase().replace(/[^a-z0-9_]/g,'');
    setChecking(true);
    try{
      const deviceId = Device.osInternalBuildId || Device.osBuildId || 'unknown_device';

      // FIX 1: PEHLE PHONE CHECK KARO (Reinstall fix)
      const phoneQ=query(collection(db,"users"), where("phone","==",loginPhone));
      const phoneSnap=await getDocs(phoneQ);
      if(!phoneSnap.empty){
        const exDoc = phoneSnap.docs[0];
        const ex = exDoc.data();
        // Device ID update kar do naye se, taaki purana logout ho jaye
        await updateDoc(doc(db,"users", exDoc.id), { deviceId: deviceId });

        await AsyncStorage.setItem('bazz_id',ex.bazzId);
        await AsyncStorage.setItem('bazz_name',ex.name);
        await AsyncStorage.setItem('bazz_phone',ex.phone);
        await AsyncStorage.setItem('bazz_idName',ex.idName);
        await AsyncStorage.setItem('join_date', new Date().toISOString());
        setMyId(ex.bazzId); setMyName(ex.name); setMyPhone(ex.phone); setIsLoggedIn(true);
        setChecking(false);
        Alert.alert('Wapas Swagat Hai!', `ID: ${ex.bazzId}`);
        return;
      }

      // FIX 2: NAYA USER HAI TABHI DEVICE CHECK KARO
      const deviceQ=query(collection(db,"users"), where("deviceId","==",deviceId));
      const deviceSnap=await getDocs(deviceQ);
      if(!deviceSnap.empty){
        setChecking(false);
        return Alert.alert('1 Device = 1 ID', `Is phone me pehle se ID hai: ${deviceSnap.docs[0].data().bazzId}\n Dusra nahi ban sakta`);
      }

      const idQ=query(collection(db,"users"), where("idName","==",cleanId));
      const idSnap=await getDocs(idQ);
      if(!idSnap.empty){ setChecking(false); return Alert.alert('ID Already Hai',`${cleanId}123 try karo`); }

      const finalBazzId=`BAZZ@${cleanId}`;
      const now=new Date().toISOString();
      await AsyncStorage.setItem('bazz_id',finalBazzId); await AsyncStorage.setItem('bazz_name',loginName);
      await AsyncStorage.setItem('bazz_phone',loginPhone); await AsyncStorage.setItem('bazz_idName',cleanId);
      await AsyncStorage.setItem('watched_'+finalBazzId,'0'); await AsyncStorage.setItem('join_date',now);
      setMyId(finalBazzId); setMyName(loginName); setMyPhone(loginPhone); setJoinDate(new Date()); setIsLoggedIn(true);
      await addDoc(collection(db,"users"),{bazzId:finalBazzId, idName:cleanId, name:loginName, phone:loginPhone, deviceId, bonus:WELCOME_BONUS, createdAt:serverTimestamp()});
      Alert.alert('ID Ban Gayi!',`ID: ${finalBazzId} ₹10 Bonus`);
      const vSnap=await getDocs(query(collection(db,"videos"),orderBy("createdAt","desc")));
      setVideos(vSnap.docs.map(d=>({id:d.id,...d.data()})));
    }catch(e){ Alert.alert('Error',e.message); }
    setChecking(false);
  };

  const handleWatched=async(videoId, creatorId)=>{
    if(creatorId===myId) return;
    const today=new Date().toDateString();
    const dailyKey='daily_'+myId+'_'+today;
    let daily=parseInt(await AsyncStorage.getItem(dailyKey)||'0');
    if(daily>=DAILY_LIMIT){ Alert.alert('Daily Limit','500 reels khatam'); return; }
    const newCount=watchedCount+1;
    const newDaily=daily+1;
    setWatchedCount(newCount); setDailyWatched(newDaily);
    await AsyncStorage.setItem('watched_'+myId,newCount.toString());
    await AsyncStorage.setItem(dailyKey,newDaily.toString());
    try{ await updateDoc(doc(db,"videos",videoId),{views:increment(1)}); }catch(e){}
  };

  const handleCreateReel=async()=>{
    const res=await ImagePicker.launchImageLibraryAsync({
      mediaTypes:['videos'],
      allowsEditing:true,
      quality:0.3,
      videoMaxDuration:30,
    });
    if(res.canceled) return;
    const fileSize = res.assets[0].fileSize || 0;
    if(fileSize > 50*1024*1024){
      return Alert.alert('Badi Video','30 sec se kam banao, max 50MB');
    }
    setUploading(true);
    try{
      // FIX: FIREBASE STORAGE PE UPLOAD
      const response = await fetch(res.assets[0].uri);
      const blob = await response.blob();
      const fileName = `videos/${myId}_${Date.now()}.mp4`;
      const storageRef = ref(storage, fileName);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      await addDoc(collection(db,"videos"),{
        url: downloadURL,
        bazzId: myId,
        name: myName,
        views: 0,
        compressed: true,
        createdAt: serverTimestamp()
      });
      Alert.alert('✅ Upload Done!',`Video sabko dikhega ab`);
      setShowCreate(false);
      const snap=await getDocs(query(collection(db,"videos"),orderBy("createdAt","desc")));
      setVideos(snap.docs.map(d=>({id:d.id,...d.data()})));
    }catch(e){ Alert.alert('Upload Error',e.message); }
    setUploading(false);
  };

  const handleLogout=async()=>{ await AsyncStorage.clear(); setIsLoggedIn(false); };
  const myVideos=videos.filter(v=>v.bazzId===myId);
  const creatorEarn=myVideos.reduce((s,v)=>s+(v.views||0),0)*CREATOR_RATE;
  const watchEarn=watchedCount*WATCH_RATE;
  const totalBal=WELCOME_BONUS+watchEarn+creatorEarn;
  const amt=parseFloat(withdrawAmt)||0; const fee=amt*FEE_PERCENT/100; const net=amt-fee;
  const accountAgeDays = joinDate? Math.floor((new Date() - joinDate)/(1000*60*60*24)) : 0;
  const canWithdraw = watchedCount>=100 && myVideos.length>=1 && accountAgeDays>=1;

  if(loading) return <View style={styles.center}><ActivityIndicator color="#00f5ff" /></View>;
  if(!isLoggedIn){
    return(
      <View style={styles.loginBg}>
        <Text style={styles.loginLogo}>Reel Bazz PRO</Text>
        <Text style={styles.loginSub}>1 Device 1 ID • Auto Login</Text>
        <View style={styles.loginCard}>
          <Text style={styles.loginTitle}>Account Banao / Login</Text>
          <TextInput style={styles.input} placeholder="Naam" placeholderTextColor="#666" value={loginName} onChangeText={setLoginName} />
          <TextInput style={styles.input} placeholder="Mobile 10 digit" placeholderTextColor="#666" value={loginPhone} onChangeText={setLoginPhone} keyboardType="phone-pad" maxLength={10} />
          <View style={{flexDirection:'row',alignItems:'center',backgroundColor:'#111',borderWidth:1,borderColor:'#00f5ff',borderRadius:12,paddingHorizontal:12}}><Text style={{color:'#00f5ff',fontWeight:'900'}}>BAZZ@</Text><TextInput style={{flex:1,padding:12,color:'#fff'}} placeholder="raj123" placeholderTextColor="#666" value={loginIdName} onChangeText={setLoginIdName} autoCapitalize="none" /></View>
          <TouchableOpacity onPress={handleLogin} style={styles.loginBtn} disabled={checking}>{checking? <ActivityIndicator color="#000" /> : <Text style={styles.loginBtnT}>ID Banao & ₹10 Pao</Text>}</TouchableOpacity>
          <Text style={{color:'#555',fontSize:10,marginTop:10,textAlign:'center'}}>Purana user? Sirf Mobile number same dalo, ID auto login ho jayegi</Text>
        </View>
      </View>
    )
  }
  return(
    <View style={styles.container}>
      <View style={styles.header}><Text style={styles.logo}>Reel Bazz</Text><View><Text style={styles.bal}>₹{totalBal.toFixed(2)}</Text><Text style={styles.small}>{myId} • {dailyWatched}/500</Text></View></View>
      {tab==='home' && (
        <FlatList
          data={videos}
          keyExtractor={item=>item.id}
          pagingEnabled
          snapToInterval={height-130}
          snapToAlignment="start"
          decelerationRate="fast"
          showsVerticalScrollIndicator={false}
          viewabilityConfig={viewabilityConfig}
          onViewableItemsChanged={onViewableItemsChanged}
          windowSize={2}
          maxToRenderPerBatch={1}
          initialNumToRender={1}
          removeClippedSubviews={true}
          getItemLayout={(data,index)=>({length: height-130, offset: (height-130)*index, index})}
          renderItem={({item, index})=>(
            <VideoItem v={item} isActive={index===activeIndex} onWatched={handleWatched} myId={myId} />
          )}
        />
      )}
      {tab==='earnings' && (
        <ScrollView style={styles.page}>
          <View style={styles.bigCard}><Text style={styles.cardLabel}>TOTAL BALANCE</Text><Text style={styles.bigAmt}>₹{totalBal.toFixed(2)}</Text><View style={styles.row}><View style={styles.mini}><Text style={styles.miniL}>Watch {watchedCount}</Text><Text style={styles.miniV}>₹{watchEarn.toFixed(2)}</Text></View><View style={styles.mini}><Text style={styles.miniL}>Daily {dailyWatched}/500</Text><Text style={styles.miniV}>₹{(dailyWatched*WATCH_RATE).toFixed(2)}</Text></View><View style={styles.mini}><Text style={styles.miniL}>Creator</Text><Text style={styles.miniV}>₹{creatorEarn.toFixed(2)}</Text></View></View></View>
          {!canWithdraw && <View style={{backgroundColor:'#331111',padding:12,borderRadius:10,marginTop:12}}><Text style={{color:'#ff8888',fontSize:12}}>Withdraw: {watchedCount}/100 reels • {myVideos.length}/1 video • {accountAgeDays}/1 din</Text></View>}
          <Text style={styles.title}>Withdraw (Min ₹100 + 10% Fee)</Text>
          <TextInput style={styles.input} placeholder="UPI ID" placeholderTextColor="#666" value={upiId} onChangeText={setUpiId} onFocus={()=>ScreenCapture.preventScreenCaptureAsync()} onBlur={()=>ScreenCapture.allowScreenCaptureAsync()} />
          <TextInput style={styles.input} placeholder="Amount Min 100" placeholderTextColor="#666" value={withdrawAmt} onChangeText={setWithdrawAmt} keyboardType="numeric" />
          {amt>=10 && <View style={styles.feeBox}><View style={styles.feeRow}><Text style={styles.feeL}>Amount</Text><Text style={styles.feeV}>₹{amt}</Text></View><View style={styles.feeRow}><Text style={styles.feeL}>Fee 10%</Text><Text style={[styles.feeV,{color:'#ff4444'}]}>-₹{fee.toFixed(2)}</Text></View><View style={[styles.feeRow,{borderTopWidth:1,borderColor:'#333',marginTop:8,paddingTop:8}]}><Text style={[styles.feeL,{color:'#fff',fontWeight:'900'}]}>Milega</Text><Text style={[styles.feeV,{color:'#00ff88'}]}>₹{net.toFixed(2)}</Text></View></View>}
          <TouchableOpacity onPress={async()=>{
            if(!canWithdraw) return Alert.alert('Abhi nahi','100 reels + 1 video + 1 din');
            if(!upiId.includes('@')) return Alert.alert('UPI galat');
            if(amt<MIN_WITHDRAW) return Alert.alert(`Min ₹${MIN_WITHDRAW}`);
            if(amt>totalBal) return Alert.alert('Balance kam');
            await addDoc(collection(db,"withdraws"),{bazzId:myId,name:myName,upiId,amount:amt,fee,netAmount:net,status:'Pending',createdAt:serverTimestamp()});
            Alert.alert('Sent','24h me ayega');
          }} style={[styles.wBtn,{opacity:canWithdraw?1:0.4}]}><Text style={styles.wText}>Withdraw ₹{net>0?net.toFixed(2):'0'}</Text></TouchableOpacity>
        </ScrollView>
      )}
      {tab==='profile' && <View style={styles.page}><View style={styles.bigCard}><Text style={{color:'#fff',fontSize:20,fontWeight:'900'}}>{myName} ({myId})</Text><Text style={{color:'#888',marginTop:6}}>{myPhone} • {accountAgeDays} days • {watchedCount} watched</Text><TouchableOpacity onPress={handleLogout} style={{marginTop:16,backgroundColor:'#222',padding:12,borderRadius:10,alignItems:'center'}}><Text style={{color:'#ff4444'}}>Logout</Text></TouchableOpacity></View></View>}
      <View style={styles.bottomNav}>
        <TouchableOpacity onPress={()=>setTab('home')}><Text style={[styles.navIcon,tab==='home'&&{color:'#ff00ff'}]}>⌂</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setTab('earnings')}><Text style={[styles.navIcon,tab==='earnings'&&{color:'#ff00ff'}]}>₹</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setShowCreate(true)} style={styles.createBtn}><Text style={styles.createPlus}>+</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setShowInvite(true)}><Text style={styles.navIcon}>🎁</Text></TouchableOpacity>
        <TouchableOpacity onPress={()=>setTab('profile')}><Text style={[styles.navIcon,tab==='profile'&&{color:'#ff00ff'}]}>○</Text></TouchableOpacity>
      </View>
      <Modal visible={showCreate} transparent animationType="slide"><View style={styles.modalBg}><View style={styles.modalBox}><Text style={{color:'#fff',fontWeight:'800',marginBottom:8}}>30 sec max • Auto Compress 0.3 quality</Text><TouchableOpacity onPress={handleCreateReel} style={styles.wBtn}>{uploading?<ActivityIndicator color="#000" />:<Text style={styles.wText}>Video Chuno (Auto Compress)</Text>}</TouchableOpacity><TouchableOpacity onPress={()=>setShowCreate(false)}><Text style={{color:'#fff',textAlign:'center',marginTop:12}}>Cancel</Text></TouchableOpacity></View></View></Modal>
      <Modal visible={showInvite} transparent animationType="slide"><View style={styles.modalBg}><View style={styles.modalBox}><Text style={{color:'#888'}}>Invite Code</Text><Text style={styles.modalCode}>{myId}</Text><TouchableOpacity onPress={()=>Share.share({message:`Join Reel Bazz ${myId}`})} style={styles.shareBtn}><Text style={{fontWeight:'900'}}>Share ₹5 Earn</Text></TouchableOpacity><TouchableOpacity onPress={()=>setShowInvite(false)}><Text style={{color:'#fff',textAlign:'center',marginTop:12}}>Close</Text></TouchableOpacity></View></View></Modal>
    </View>
  )
}

const styles=StyleSheet.create({
  center:{flex:1,justifyContent:'center',alignItems:'center',backgroundColor:'#000'},
  container:{flex:1,backgroundColor:'#000'},
  loginBg:{flex:1,backgroundColor:'#000',justifyContent:'center',padding:20},
  loginLogo:{color:'#fff',fontSize:32,fontWeight:'900',fontStyle:'italic',textAlign:'center'},
  loginSub:{color:'#666',textAlign:'center',marginTop:8,fontSize:10},
  loginCard:{backgroundColor:'#111',padding:20,borderRadius:16,marginTop:20,borderWidth:1,borderColor:'#222'},
  loginTitle:{color:'#fff',fontSize:16,fontWeight:'800',marginBottom:12},
  loginBtn:{backgroundColor:'#00f5ff',padding:14,borderRadius:12,alignItems:'center',marginTop:10},
  loginBtnT:{fontWeight:'900',color:'#000'},
  header:{flexDirection:'row',justifyContent:'space-between',paddingTop:45,paddingHorizontal:16,paddingBottom:10,backgroundColor:'#0a0a0a'},
  logo:{color:'#fff',fontSize:18,fontWeight:'900',fontStyle:'italic'},
  bal:{color:'#00ff88',fontWeight:'900',textAlign:'right'},
  small:{color:'#666',fontSize:8,textAlign:'right'},
  videoContainer:{height:height-130,width:width,backgroundColor:'#000'},
  video:{width:'100%',height:'100%'},
  vOverlay:{position:'absolute',bottom:20,left:12},
  vUser:{color:'#fff',fontWeight:'900'},
  vViews:{color:'#aaa',fontSize:11},
  watchTag:{position:'absolute',top:12,right:12,backgroundColor:'#00ff88',paddingHorizontal:8,paddingVertical:4,borderRadius:20},
  watchTagT:{color:'#000',fontSize:9,fontWeight:'900'},
  page:{flex:1,padding:16},
  bigCard:{backgroundColor:'#111',padding:20,borderRadius:16,borderWidth:1,borderColor:'#222'},
  cardLabel:{color:'#666',fontSize:10},
  bigAmt:{color:'#fff',fontSize:32,fontWeight:'900',marginTop:4},
  row:{flexDirection:'row',gap:8,marginTop:12},
  mini:{flex:1,backgroundColor:'#0a0a0a',padding:8,borderRadius:10,borderWidth:1,borderColor:'#222'},
  miniL:{color:'#666',fontSize:8},
  miniV:{color:'#fff',fontSize:11,fontWeight:'800',marginTop:2},
  title:{color:'#fff',fontWeight:'800',marginTop:16,marginBottom:8},
  input:{backgroundColor:'#111',borderWidth:1,borderColor:'#222',borderRadius:12,padding:12,color:'#fff',marginBottom:10},
  feeBox:{backgroundColor:'#111',borderRadius:12,padding:14,borderWidth:1,borderColor:'#333'},
  feeRow:{flexDirection:'row',justifyContent:'space-between',marginBottom:4},
  feeL:{color:'#888',fontSize:12},
  feeV:{color:'#fff',fontSize:12,fontWeight:'700'},
  wBtn:{backgroundColor:'#00f5ff',padding:14,borderRadius:12,alignItems:'center',marginTop:14},
  wText:{fontWeight:'900',color:'#000'},
  bottomNav:{flexDirection:'row',justifyContent:'space-around',height:70,alignItems:'center',backgroundColor:'#0a0a0a',borderTopWidth:1,borderTopColor:'#222'},
  navIcon:{color:'#666',fontSize:22},
  createBtn:{width:50,height:50,borderRadius:25,backgroundColor:'#000',borderWidth:2,borderColor:'#00f5ff',justifyContent:'center',alignItems:'center'},
  createPlus:{color:'#fff',fontSize:26},
  modalBg:{flex:1,backgroundColor:'rgba(0,0,0,0.8)',justifyContent:'flex-end'},
  modalBox:{backgroundColor:'#111',padding:24,borderTopLeftRadius:20,borderTopRightRadius:20},
  modalCode:{color:'#00f5ff',fontSize:24,fontWeight:'900',marginTop:6},
  shareBtn:{backgroundColor:'#00f5ff',padding:14,borderRadius:12,alignItems:'center',marginTop:16}
});