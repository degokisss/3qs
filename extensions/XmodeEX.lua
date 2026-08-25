local hash = {wei = {},shu = {},wu = {},qun = {},careerist = {}}
for _,general in pairs(sgs.Sanguosha:getLimitedGeneralNames())do
	if general:startsWith("lord_") then continue end
	if hash[sgs.Sanguosha:getGeneral(general):getKingdom()] then
		table.insert(hash[sgs.Sanguosha:getGeneral(general):getKingdom()],general)
	end
end
function getRandomGenerals (n,kingdom,remove_k,exceptions)
	hash[kingdom] = table.Shuffle(hash[kingdom])
	local result = {}
	if kingdom == "careerist" then
		local count = 0
		for _,general in pairs(hash["careerist"])do
			if #result == n or count == 5 then break end
			if not table.contains(exceptions,general) then
				table.insert(result,general)
				count = count + 1
			end
		end
		if #result < n then
			hash[remove_k] = table.Shuffle(hash[remove_k])
			for _,general in pairs(hash[remove_k])do
				if #result == n or count == 5 then break end
				if not table.contains(exceptions,general) then
					table.insert(result,general)
					count = count + 1
				end
			end
		end
	else
		for _,general in pairs(hash[kingdom])do
			if #result == n then break end
			if not table.contains(exceptions,general) then
				table.insert(result,general)
			end
		end
	end
	return result
end

XmodeRule = sgs.CreateTriggerSkill{
	name = "XmodeRule_EX",
	events = {sgs.BuryVictim},
	on_effect = function(self, evnet, room, player, data,ask_who)
		local remove_k =  room:getTag("Xmode_RemoveKingdom"):toString()
		local change_k = player:getKingdom()
		local damage = data:toDeath().damage
		local from, revive_k
		if damage and damage.from
		and player:getRole() ~= "careerist" and player:getKingdom() ~= remove_k then
			from = damage.from
			if from:getRole() == "careerist" or from:getKingdom() == "careerist" then--被野心家杀不复活
				return false
			end
			revive_k = from:getKingdom()
			room:writeToConsole("伤害来源:"..revive_k)
		end
		player:bury()
		if from then
			local upperlimit =  math.floor(room:getAlivePlayers():length() / 2)--from:getLord() and 99 or
			if player:getPlayerNumWithSameKingdom(self:objectName(),revive_k) <= upperlimit then
				change_k = revive_k
			end
		end
		local times = room:getTag(change_k.."_Change"):toInt()
		if times >= 2 then
			times = room:getTag(player:getKingdom().."_Change"):toInt()
			change_k = player:getKingdom()
		end
		room:writeToConsole("目标势力:"..change_k)
		player:speak(times+1)
		if player:getActualGeneral1():getKingdom() == "careerist" and times >= 1 then
			return false
		end
		if times >= 2 then
			return false
		end
		local used = room:getTag("Xmode_UsedGeneral"):toString():split("+")
		local random_general = getRandomGenerals(sgs.GetConfig("HegemonyMaxChoice",0),player:getActualGeneral1():getKingdom(),remove_k,used)
		local choice = room:askForGeneral(player,table.concat(random_general,"+"),nil,false):split("+")
		table.insertTable(used,choice)
		room:setTag("Xmode_UsedGeneral",sgs.QVariant(table.concat(used,"+")))
		room:doDragonPhoenix(player,choice[1], choice[2],true,change_k,false,"h",true)
		player:drawCards(3)
		player:setKingdom(change_k)
		room:broadcastProperty(player,"kingdom")
		times = times + 1
		room:setTag(change_k.."_Change",sgs.QVariant(times))
		return true --不知道能不能处理飞龙
	end,
	priority = 1,
}
Xmode = {
	name = "Xmode_hegemony_EX",
	expose_role = false,
	player_count = 10,
	random_seat = true,
	rule = XmodeRule,
	on_assign = function(self, room)
		local generals, generals2, kingdoms = {},{},{}
		local kingdom = {"wei","shu","wu","qun",}
		local rules_count = {["wei"] = 0,["shu"] = 0,["wu"] = 0,["qun"] = 0}
		local remove_k = table.remove(kingdom, math.random(1,#kingdom))
		room:setTag("Xmode_RemoveKingdom",sgs.QVariant(remove_k))
		for i = 1, 9, 1 do
			local role = kingdom[math.random(1,#kingdom)]
			rules_count[role] = rules_count[role] + 1
			if rules_count[role] == 3 then table.removeOne(kingdom,role) end
			table.insert(kingdoms, role)
		end
		local position = math.random(1,#kingdoms)
		if math.random(0,1) > 0 and #hash["careerist"] > 0 then
			table.insert(kingdoms, position, "careerist")
		else
			table.insert(kingdoms, position, remove_k)
		end
		--上面的代码是为了随机分配国家，随机移除一个势力，每个势力有3个人，外加一个野心家或移除的势力。

		local selected = {}
		for i = 1,10,1 do --开始给每名玩家分配待选择的武将。
			local player = room:getPlayers():at(i-1) --获取相关玩家
			player:clearSelected()  --清除已经分配的武将
			--如果不清除的话可能会获得上次askForGeneral的武将。
			local random_general = getRandomGenerals(sgs.GetConfig("HegemonyMaxChoice",0),kingdoms[i],remove_k,selected)
			--随机获得HegemonyMaxChoice个武将。
			--函数getRandomGenerals在本文件内定义，可以参考之。
			for _,general in pairs(random_general)do
				player:addToSelected(general)
				--这个函数就是把武将分发给相关玩家。
				--分发的武将会在选将框中出现。
				table.insert(selected,general)
			end
		end
		room:chooseGenerals(room:getPlayers(),true,true)
		--这部分将在附录A中介绍。
		for i = 1,10,1 do --依次设置genera1、general2。
			local player = room:getPlayers():at(i-1)
			generals[i] = player:getGeneralName() --获取武将，这个是chooseGenerals分配的。
			generals2[i] = player:getGeneral2Name() --同上
			local used = room:getTag("Xmode_UsedGeneral"):toString():split("+")
			table.insert(used,generals[i]) --设置返回值generals。
			table.insert(used,generals2[i])	--设置返回值generals2。
			room:setTag("Xmode_UsedGeneral",sgs.QVariant(table.concat(used,"+"))) --记录使用过的武将。
		end
		return generals, generals2, kingdoms
	end,
}
sgs.LoadTranslationTable{
	["Xmode_hegemony_EX"] = "Nhất Thống Thiên Hạ",
}
return sgs.CreateLuaScenario(Xmode)